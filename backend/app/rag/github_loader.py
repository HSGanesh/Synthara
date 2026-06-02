import os
import shutil
import tempfile
from git import Repo
from langchain_core.documents import Document

SUPPORTED_EXTENSIONS = [
    # Python
    '.py',

    # JavaScript / TypeScript
    '.js', '.ts', '.jsx', '.tsx',

    # Web
    '.html', '.css', '.scss', '.sass',

    # Documentation
    '.md', '.txt', '.rst',

    # Config
    '.json', '.yaml', '.yml', '.toml', '.ini',

    # Shell
    '.sh', '.bash', '.zsh',

    # Java
    '.java',

    # C / C++
    '.c', '.cpp', '.h', '.hpp',

    # Go
    '.go',

    # Rust
    '.rs',

    # SQL
    '.sql',

    # Ruby
    '.rb',

    # PHP
    '.php',

    # Swift
    '.swift',

    # Kotlin
    '.kt',
]

EXCLUDED_DIRS = [
    'node_modules',
    '.git',
    '__pycache__',
    'venv',
    '.venv',
    'dist',
    'build',
    '.next',
    'coverage',
    '.cache',
    '.idea',
    '.vscode',
    'target',
    'out',
    'bin',
    'obj'
]

EXCLUDED_FILES = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'poetry.lock',
    'Cargo.lock'
]


def clone_repo(repo_url: str) -> str:
    """
    Clone repository into temporary directory.
    """
    tmp_dir = tempfile.mkdtemp()

    print(f"Cloning {repo_url}")
    print(f"Destination: {tmp_dir}")

    Repo.clone_from(repo_url, tmp_dir)

    return tmp_dir


def get_repo_name(repo_url: str) -> str:
    """
    https://github.com/user/repo-name
    -> repo-name
    """
    return repo_url.rstrip('/').split('/')[-1]


def is_supported_file(file_name: str) -> bool:
    """
    Handles special cases like .env.example
    """

    if file_name == ".env.example":
        return True

    ext = os.path.splitext(file_name)[-1].lower()

    return ext in SUPPORTED_EXTENSIONS


def load_repo_files(
    repo_path: str,
    repo_url: str = ""
) -> list[Document]:

    documents = []

    repo_name = (
        get_repo_name(repo_url)
        if repo_url
        else os.path.basename(repo_path)
    )

    for root, dirs, files in os.walk(repo_path):

        # Remove unwanted directories
        dirs[:] = [
            d for d in dirs
            if d not in EXCLUDED_DIRS
        ]

        for file in files:

            # Skip lock files and generated files
            if file in EXCLUDED_FILES:
                continue

            if not is_supported_file(file):
                continue

            file_path = os.path.join(root, file)

            relative_path = os.path.relpath(
                file_path,
                repo_path
            )

            try:
                with open(
                    file_path,
                    "r",
                    encoding="utf-8",
                    errors="ignore"
                ) as f:
                    raw_content = f.read()

                if not raw_content.strip():
                    continue

                ext = os.path.splitext(file)[-1].lower()

                # Add metadata directly into chunk text
                content = f"""
FILE: {relative_path}
FILENAME: {file}
REPOSITORY: {repo_name}
LANGUAGE: {ext}

{raw_content}
"""

                documents.append(
                    Document(
                        page_content=content,
                        metadata={
                            "source": relative_path,
                            "file": file,
                            "repo": repo_name,
                            "language": ext,
                            "type": "github"
                        }
                    )
                )

            except Exception as e:
                print(
                    f"Skipping {relative_path}: {e}"
                )

    print(
        f"✅ Loaded {len(documents)} files from repository '{repo_name}'"
    )

    return documents


def cleanup_repo(repo_path: str):
    """
    Remove temporary cloned repository.
    """

    shutil.rmtree(
        repo_path,
        ignore_errors=True
    )

    print(f"✅ Cleaned up {repo_path}")

import json

def generate_repo_map(documents: list[Document]) -> dict:
    """
    Build a lightweight structural map of the repository from loaded documents.
    Categorises files into components, hooks, configs, and entry points.
    """
    repo_map = {
    "readme": [],
    "entrypoint": [],
    "components": [],
    "hooks": [],
    "configs": [],
    "services": [],
    "api_routes": [],
    "models": [],
    "others": [],
}

    entrypoint_names = {"main.py", "main.ts", "main.tsx", "index.ts", "index.tsx", "index.js", "app.py", "server.py"}
    config_extensions = {".json", ".yaml", ".yml", ".toml", ".ini", ".env"}

    for doc in documents:
        source: str = doc.metadata.get("source", "")
        filename: str = doc.metadata.get("file", "")
        ext: str = doc.metadata.get("language", "")

        lower_name = filename.lower()
        lower_source = source.lower()

        if lower_name in entrypoint_names or lower_name in ("main.jsx",):
            repo_map["entrypoint"].append(source)
        elif ext in config_extensions or lower_name in ("dockerfile", ".gitignore", ".env.example"):
            repo_map["configs"].append(source)
        elif "hook" in lower_source or lower_name.startswith("use"):
            repo_map["hooks"].append(source)
        elif any(seg in lower_source for seg in ("component", "components", "widget", "ui")):
            repo_map["components"].append(source)
        else:
            repo_map["others"].append(source)

    return repo_map