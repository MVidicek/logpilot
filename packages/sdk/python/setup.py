from setuptools import setup, find_packages

setup(
    name="logpilot-sdk",
    version="1.0.0",
    description="Python SDK for LogPilot log aggregation",
    author="Marko Vidicek",
    author_email="marko.vidicek@outlook.com",
    url="https://github.com/MVidicek/logpilot",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
    ],
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: System :: Logging",
    ],
)
