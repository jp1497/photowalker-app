"""Structured logging setup. See PRD v2 - Logging Strategy."""
import logging

from pythonjsonlogger.json import JsonFormatter


def setup_logging(environment: str) -> None:
    """Configure root logger with JSON formatter and level by environment."""
    log_level = logging.DEBUG if environment == "development" else logging.INFO
    handler = logging.StreamHandler()
    formatter = JsonFormatter("%(asctime)s %(name)s %(levelname)s %(message)s")
    handler.setFormatter(formatter)
    logger = logging.getLogger()
    logger.setLevel(log_level)
    logger.addHandler(handler)
    # Reduce boto/botocore noise in development (they log every request at DEBUG)
    for name in ("boto3", "botocore", "urllib3"):
        logging.getLogger(name).setLevel(logging.WARNING)
