"""FastAPI application entry point. Uses factory pattern per Step 1.1."""
from app.core.config import get_settings
from app.core.factory import create_app

settings = get_settings()
app = create_app(settings)
