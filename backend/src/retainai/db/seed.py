"""Legacy seed shim — re-exports canonical seeding."""
from retainai.scripts.seed_database import seed_demo_data, seed_data, get_dataset_path
__all__ = ["seed_demo_data", "seed_data", "get_dataset_path"]
