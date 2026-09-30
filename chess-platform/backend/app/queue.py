import redis
from rq import Queue

from .config import REDIS_URL

redis_conn = redis.from_url(REDIS_URL)
analysis_queue = Queue("analysis", connection=redis_conn)
