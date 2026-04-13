import boto3
from botocore.exceptions import ClientError
from botocore.config import Config
from app.config import settings


def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def upload_file(file_bytes: bytes, filename: str) -> str:
    """Uploads a file to R2 and returns the object key."""
    s3 = get_r2_client()
    content_type = "audio/wav"
    
    s3.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=filename,
        Body=file_bytes,
        ContentType=content_type,
    )
    return filename


def get_upload_presigned_url(
    object_name: str,
    content_type: str = "audio/wav",
    expiration: int = 3600,
) -> str:
    """Generates a presigned URL for uploading an object to R2."""
    s3 = get_r2_client()
    return s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": object_name,
            "ContentType": content_type,
        },
        ExpiresIn=expiration,
    )


def get_download_presigned_url(object_name: str, expiration: int = 3600) -> str:
    """Generates a presigned URL for downloading an object from R2."""
    s3 = get_r2_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": object_name},
        ExpiresIn=expiration,
    )


def get_object_metadata(object_name: str) -> dict | None:
    """Return R2 object metadata, or None if the object is not present."""
    s3 = get_r2_client()
    try:
        return s3.head_object(Bucket=settings.R2_BUCKET_NAME, Key=object_name)
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code in {"404", "NoSuchKey", "NotFound"}:
            return None
        raise


def delete_file(object_name: str) -> None:
    """Delete an object from R2."""
    s3 = get_r2_client()
    s3.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=object_name)
