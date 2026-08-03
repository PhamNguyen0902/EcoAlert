import asyncio
import ipaddress
import secrets
import socket
from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException, Request, status

from .config import Settings


def require_internal_token(request: Request, settings: Settings) -> None:
    supplied = request.headers.get("x-internal-service-token", "")
    if not settings.internal_token or not secrets.compare_digest(supplied, settings.internal_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def validate_image_url(url: str, settings: Settings) -> str:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme not in {"http", "https"} or not host or parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Invalid image URL")
    if not settings.allowed_hosts or host not in settings.allowed_hosts:
        raise HTTPException(status_code=400, detail="Image host is not allowed")
    return host


async def reject_private_resolution(host: str, settings: Settings) -> None:
    if settings.allow_private_hosts:
        return

    def resolve() -> list[str]:
        return list({item[4][0] for item in socket.getaddrinfo(host, None)})

    try:
        addresses = await asyncio.to_thread(resolve)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="Image host could not be resolved") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise HTTPException(status_code=400, detail="Private image hosts are not allowed")


async def fetch_image(
    url: str,
    settings: Settings,
    resolver_guard: Callable[[str, Settings], Awaitable[None]] = reject_private_resolution,
    client_factory: Callable[..., httpx.AsyncClient] = httpx.AsyncClient,
) -> bytes:
    host = validate_image_url(url, settings)
    await resolver_guard(host, settings)
    timeout = httpx.Timeout(settings.request_timeout_seconds)
    try:
        async with client_factory(timeout=timeout, follow_redirects=False) as client:
            async with client.stream("GET", url, headers={"Accept": "image/*"}) as response:
                if 300 <= response.status_code < 400:
                    raise HTTPException(status_code=400, detail="Image redirects are not allowed")
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
                if not content_type.startswith("image/"):
                    raise HTTPException(status_code=415, detail="URL did not return an image")
                declared_size = response.headers.get("content-length")
                if declared_size and int(declared_size) > settings.max_image_bytes:
                    raise HTTPException(status_code=413, detail="Image is too large")
                chunks: list[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > settings.max_image_bytes:
                        raise HTTPException(status_code=413, detail="Image is too large")
                    chunks.append(chunk)
                return b"".join(chunks)
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Image could not be downloaded") from exc
