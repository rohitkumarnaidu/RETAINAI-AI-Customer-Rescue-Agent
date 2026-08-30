"""ChromaDB-backed Experience Memory for semantic retrieval (S24/P2).

Replaces Redis for memory use-case. Redis = dedup/queue (ephemeral, fast).
Chroma = vector memory (semantic similarity, persistent). For hackathon we use
SQLite + Chroma hybrid: SQLite is source of truth, Chroma is optional vector index.
Falls back to SQL filtering if chromadb not installed.
"""

import logging
import hashlib
from typing import List, Dict, Any, Optional

logger = logging.getLogger("retainai.chroma")

def _embed(text: str) -> List[float]:
    """Deterministic cheap embedding (no external model) for demo.
    In prod replace with real embeddings (openai/gemini). 8-dim hash embedding."""
    h = hashlib.sha256(text.encode()).hexdigest()
    # 8 floats in [0,1]
    return [int(h[i*2:i*2+2], 16)/255.0 for i in range(8)]

class ChromaMemoryStore:
    """Thin wrapper; uses real chromadb if available else in-memory dict."""
    def __init__(self, collection_name: str = "retainai_experience"):
        self.collection_name = collection_name
        self._use_chroma = False
        self._client = None
        self._collection = None
        self._fallback: Dict[str, Dict[str, Any]] = {}
        try:
            import chromadb  # type: ignore
            self._client = chromadb.Client()
            self._collection = self._client.get_or_create_collection(name=collection_name)
            self._use_chroma = True
            logger.info("ChromaMemoryStore: using real chromadb")
        except Exception as e:
            logger.info(f"ChromaMemoryStore: fallback in-memory (chromadb not available: {e})")

    async def upsert(self, memory_id: str, pattern: str, segment: str, text: str, metadata: Dict[str, Any]):
        emb = _embed(f"{pattern} {segment} {text}")
        if self._use_chroma:
            try:
                self._collection.upsert(ids=[memory_id], embeddings=[emb], documents=[text], metadatas=[{**metadata, "pattern": pattern, "segment": segment}])
                return
            except Exception as e:
                logger.warning(f"Chroma upsert failed, fallback: {e}")
        self._fallback[memory_id] = {"pattern": pattern, "segment": segment, "text": text, "embedding": emb, "metadata": metadata}

    async def query(self, query_text: str, segment: Optional[str] = None, top_k: int = 3) -> List[Dict[str, Any]]:
        q_emb = _embed(query_text)
        if self._use_chroma and self._collection:
            try:
                where = {"segment": segment} if segment else None
                res = self._collection.query(query_embeddings=[q_emb], n_results=top_k, where=where)
                ids = res.get("ids", [[]])[0]
                docs = res.get("documents", [[]])[0]
                metas = res.get("metadatas", [[]])[0]
                dists = res.get("distances", [[]])[0] if "distances" in res else [0]*len(ids)
                return [{"id": i, "text": d, "metadata": m, "distance": dist} for i,d,m,dist in zip(ids, docs, metas, dists)]
            except Exception as e:
                logger.warning(f"Chroma query failed, fallback: {e}")
        # Fallback: cosine-ish via dot product
        def dot(a,b): return sum(x*y for x,y in zip(a,b))
        scored=[]
        for mid, rec in self._fallback.items():
            if segment and rec["segment"] != segment:
                continue
            score=dot(q_emb, rec["embedding"])
            scored.append((score, mid, rec))
        scored.sort(reverse=True)
        return [{"id": mid, "text": rec["text"], "metadata": rec["metadata"], "score": s} for s,mid,rec in scored[:top_k]]

# Singleton for app
_chroma_store: Optional[ChromaMemoryStore] = None
def get_chroma_store() -> ChromaMemoryStore:
    global _chroma_store
    if _chroma_store is None:
        _chroma_store = ChromaMemoryStore()
    return _chroma_store
