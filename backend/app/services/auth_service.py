import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Simple in-memory user store for MVP
fake_users_db = {}

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def register_user(username: str, password: str) -> bool:
    if username in fake_users_db:
        return False
    fake_users_db[username] = hash_password(password)
    return True

def authenticate_user(username: str, password: str) -> bool:
    if username not in fake_users_db:
        return False
    return verify_password(password, fake_users_db[username])