import pytest
import httpx
from fastapi import HTTPException

from app.config import Settings
from app.security import fetch_image, validate_image_url


def settings():
    return Settings(VISION_ALLOWED_IMAGE_HOSTS="images.example.test")


def test_only_explicitly_allowed_hosts_are_accepted():
    assert validate_image_url("https://images.example.test/evidence.jpg", settings()) == "images.example.test"
    with pytest.raises(HTTPException) as error:
        validate_image_url("https://attacker.example/evidence.jpg", settings())
    assert error.value.status_code == 400


@pytest.mark.parametrize("url", [
    "file:///etc/passwd",
    "ftp://images.example.test/a.jpg",
    "https://user:password@images.example.test/a.jpg",
])
def test_unsafe_url_forms_are_rejected(url):
    with pytest.raises(HTTPException):
        validate_image_url(url, settings())


@pytest.mark.asyncio
async def test_download_timeout_is_mapped_to_a_safe_client_error():
    async def allow_resolution(host, configured):
        return None

    def timeout_client(**kwargs):
        async def handler(request):
            raise httpx.ConnectTimeout("timed out", request=request)

        return httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs)

    with pytest.raises(HTTPException) as error:
        await fetch_image(
            "https://images.example.test/a.jpg",
            settings(),
            resolver_guard=allow_resolution,
            client_factory=timeout_client,
        )
    assert error.value.status_code == 400
