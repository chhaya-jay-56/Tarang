import ssl
from celery import Celery
from app.config import settings

# Upstash Redis often requires SSL, but let's configure it securely.
broker_url = settings.CELERY_BROKER_URL
result_backend = settings.CELERY_RESULT_BACKEND

# If Upstash Redis is used, we might need SSL config depending on the connection string (rediss:// vs redis://).
# We'll set the broker_use_ssl if the protocol is rediss://
broker_use_ssl = {
    'ssl_cert_reqs': ssl.CERT_NONE
} if broker_url and broker_url.startswith('rediss://') else None

celery_app = Celery(
    "tarang_worker",
    broker=broker_url,
    backend=result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    
    # --- UPSTASH QUOTA SAVING CONFIGURATION ---
    # Disable gossiping and events that cause massive Redis read/writes
    worker_send_task_events=False,
    task_send_sent_event=False,
    worker_enable_remote_control=False, # Disables remote control commands
    broker_pool_limit=1,                # Less connections
    broker_connection_timeout=30,
    broker_heartbeat=None,              # Disables heartbeat checks
    worker_prefetch_multiplier=1,       # Fetch one task at a time
)

if broker_use_ssl:
    celery_app.conf.update(
        broker_use_ssl=broker_use_ssl,
        redis_backend_use_ssl=broker_use_ssl,
    )

# Optional: Autodiscover tasks here if needed
# celery_app.autodiscover_tasks(["app.services", "app.utils"])

@celery_app.task(bind=True, name="app.celery_app.test_task")
def test_task(self):
    print("Celery is working perfectly with Upstash Redis!")
    return "Success"
