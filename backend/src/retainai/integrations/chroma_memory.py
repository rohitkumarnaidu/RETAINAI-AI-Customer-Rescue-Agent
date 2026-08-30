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
    """Thin wrapper; uses real chromadb if available else in-memory dict. Tenant-namespaced via collection tenant_{id}_memories."""
    def __init__(self, collection_name: str = "retainai_experience"):
        self.collection_name = collection_name
        self._use_chroma = False
        self._client = None
        self._collections: Dict[str, Any] = {}
        self._fallback: Dict[str, Dict[str, Any]] = {}
        # For backward compat, keep _collection alias
        self._collection = None
        try:
            import chromadb  # type: ignore
            self._client = chromadb.Client()
            self._collection = self._client.get_or_create_collection(name=collection_name)
            self._collections[collection_name] = self._collection
            self._use_chroma = True
            logger.info("ChromaMemoryStore: using real chromadb")
        except Exception as e:
            logger.info(f"ChromaMemoryStore: fallback in-memory (chromadb not available: {e})")

    def _get_collection(self, tenant_id: Optional[str] = None):
        """Get tenant-namespaced collection: tenant_{id}_memories else default."""
        if not self._use_chroma or not self._client:
            return None
        if tenant_id:
            name = f"tenant_{tenant_id}_memories"
        else:
            name = self.collection_name
        if name in self._collections:
            return self._collections[name]
        try:
            import chromadb  # type: ignore
            coll = self._client.get_or_create_collection(name=name)
            self._collections[name] = coll
            return coll
        except Exception as e:
            logger.warning(f"Chroma get_collection {name} failed: {e}")
            return self._collection

    async def upsert(self, memory_id: str, pattern: str, segment: str, text: str, metadata: Dict[str, Any], tenant_id: Optional[str] = None):
        # Tenant namespace via collection or metadata fallback
        eff_tenant = tenant_id or metadata.get("tenant_id")
        emb = _embed(f"{pattern} {segment} {text}")
        coll = self._get_collection(eff_tenant)
        if self._use_chroma and coll is not None:
            try:
                meta = {**metadata, "pattern": pattern, "segment": segment}
                if eff_tenant:
                    meta["tenant_id"] = eff_tenant
                coll.upsert(ids=[memory_id], embeddings=[emb], documents=[text], metadatas=[meta])
                return
            except Exception as e:
                logger.warning(f"Chroma upsert failed, fallback: {e}")
        key = f"{eff_tenant}::{memory_id}" if eff_tenant else memory_id
        self._fallback[key] = {"pattern": pattern, "segment": segment, "text": text, "embedding": emb, "metadata": {**metadata, "tenant_id": eff_tenant} if eff_tenant else metadata, "tenant_id": eff_tenant}

    async def query(self, query_text: str, segment: Optional[str] = None, top_k: int = 3, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        q_emb = _embed(query_text)
        coll = self._get_collection(tenant_id)
        if self._use_chroma and coll is not None:
            try:
                where = {}
                if segment:
                    where["segment"] = segment
                # Tenant already isolated via collection; if no tenant collection, filter by metadata
                if tenant_id and coll == self._collection:
                    where["tenant_id"] = tenant_id
                where = where if where else None
                res = coll.query(query_embeddings=[q_emb], n_results=top_k, where=where)
                ids = res.get("ids", [[]])[0]
                docs = res.get("documents", [[]])[0]
                metas = res.get("metadatas", [[]])[0]
                dists = res.get("distances", [[]])[0] if "distances" in res else [0]*len(ids)
                return [{"id": i, "text": d, "metadata": m, "distance": dist} for i,d,m,dist in zip(ids, docs, metas, dists)]
            except Exception as e:
                logger.warning(f"Chroma query failed, fallback: {e}")
        # Fallback: cosine-ish via dot product, filter by tenant
        def dot(a,b): return sum(x*y for x,y in zip(a,b))
        scored=[]
        for mid, rec in self._fallback.items():
            if tenant_id and rec.get("tenant_id") != tenant_id:
                continue
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

def get_tenant_chroma_collection_name(tenant_id: str) -> str:
    return f"tenant_{tenant_id}_memories"
