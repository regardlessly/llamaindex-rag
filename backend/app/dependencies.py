from functools import lru_cache

from app.services.index_manager import IndexManager
from config import get_settings


@lru_cache
def get_index_manager() -> IndexManager:
    return IndexManager(get_settings())
