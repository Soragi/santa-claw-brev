FROM python:3.12.11-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libxrender1 libsm6 libxext6 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir cadquery==2.6.1 trimesh==4.8.3 pillow==11.3.0 numpy==2.2.6 networkx==3.5 scipy==1.15.3
COPY worker.py /opt/factory/worker.py
ENV PYTHONDONTWRITEBYTECODE=1 OPENBLAS_NUM_THREADS=1
WORKDIR /job
