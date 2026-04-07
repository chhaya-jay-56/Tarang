from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def setup_middlewares(app: FastAPI):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        ],
        allow_origin_regex=r"https://[a-zA-Z0-9-]+\.ngrok-free\.dev",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
