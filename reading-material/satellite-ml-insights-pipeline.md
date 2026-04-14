# Satellite Data + Deep Learning: From Raw Imagery to Actionable Intelligence

> Research compiled 2026-04-14 · TerraCube Sentinel

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Data Sources: AWS STAC & Open S3 Satellite Data](#data-sources)
3. [Foundation Models for Earth Observation](#foundation-models)
4. [ML/DL Task Categories](#ml-task-categories)
5. [Inference Infrastructure](#inference-infrastructure)
6. [Pipeline Architecture](#pipeline-architecture)
7. [Reference Implementations](#reference-implementations)
8. [Training Datasets & Benchmarks](#training-datasets)
9. [Integration with TerraCube Sentinel](#sentinel-integration)
10. [Cost & Infrastructure Considerations](#cost-infra)
11. [References](#references)

---

## Executive Summary

The convergence of open satellite data (AWS STAC, S3 open data), geospatial foundation models (Prithvi, Clay, SAM), and scalable inference infrastructure (NVIDIA Triton, SageMaker) makes it possible to build automated pipelines that go from raw satellite imagery to structured, actionable intelligence.

**The opportunity for TerraCube Sentinel:** Integrate STAC-based data ingestion with ML inference to automatically generate geospatial entities (hazards, infrastructure changes, land cover classifications) that feed into the Foundry ontology store and power the agents layer.

**Key stack recommendation:**
```
STAC (pystac-client) → Dagster (orchestration) → ML Inference (TorchGeo/Triton) → Foundry (ontology) → Agents (reasoning) → Frontend (visualization)
```

---

## Data Sources

### AWS STAC API — Earth Search (Element84)

**Earth Search** is a free STAC API providing centralized search for open geospatial data hosted on AWS. Built by Element84 using their Filmdrop platform.

- **API endpoint:** `https://earth-search.aws.element84.com/v1`
- **GitHub:** https://github.com/Element84/earth-search
- **Console:** Map-based data explorer at https://earth-search.aws.element84.com/console

**Available collections:**

| Collection | Data | Resolution | Revisit | S3 Location |
|---|---|---|---|---|
| `sentinel-2-l2a` | Sentinel-2 L2A COGs | 10m (multispectral) | 5 days | `s3://sentinel-s2-l2a/` |
| `sentinel-2-c1-l2a` | Sentinel-2 Collection 1 L2A | 10m | 5 days | `s3://sentinel-s2-l2a-c1/` |
| `landsat-c2-l2` | Landsat Collection 2 L2 (SR + ST) | 30m | 16 days | USGS S3 |
| `sentinel-1-grd` | Sentinel-1 GRD (SAR) | 10m | 6 days | `s3://sentinel-s1-grd/` |
| `copernicus-dem` | Copernicus DEM (30m / 90m) | 30m/90m | Static | `s3://copernicus-dem-30m/` |
| `naip` | NAIP Aerial Imagery | 0.6-1m | ~2 years | `s3://naip-visualization/` |

**Access pattern (Python):**
```python
from pystac_client import Client
import stackstac

catalog = Client.open("https://earth-search.aws.element84.com/v1")
collection = catalog.collection("sentinel-2-l2a")

search = collection.search(
    bbox=[lon_min, lat_min, lon_max, lat_max],
    datetime="2024-01-01/2024-12-31",
    query={"eo:cloud_cover": {"lt": 20}}
)
items = search.item_collection()

# Load as xarray DataArray (no download needed — reads COGs directly from S3)
data = stackstac.stack(items, assets=["visual", "nir", "swir16"])
```

**Why COGs matter:** Cloud-Optimized GeoTIFFs enable range requests over HTTP/S3 — you can read a 10GB Sentinel-2 scene and extract only the bands/tiles you need without downloading the whole file. This is fundamental for scalable ML pipelines.

### Other Open Data Registries

- **AWS Registry of Open Data:** https://registry.opendata.aws — includes NASA FIRMS (fire data), NOAA GOES, Copernicus
- **Microsoft Planetary Computer:** https://planetarycomputer.microsoft.com — STAC API with curated datasets
- **Google Earth Engine:** https://earthengine.google.com — server-side processing, massive data catalog
- **Copernicus Data Space:** https://dataspace.copernicus.eu — official ESA data access (Sentinel 1/2/3/5P)
- **USGS Earth Explorer:** https://earthexplorer.usgs.gov — Landsat archive
- **NASA FIRMS:** https://firms.modaps.eosdis.nasa.gov — Fire Information for Resource Management (active fire/hotspot data via API)

---

## Foundation Models

### 1. Prithvi (IBM + NASA)

**The gold standard for EO foundation models.** Pre-trained on NASA's Harmonized Landsat Sentinel-2 (HLS) global dataset — 4.2M samples over 7+ years.

- **Architecture:** Vision Transformer (ViT) adapted for multispectral EO
- **Input:** HLS imagery (6 bands: RED, GREEN, BLUE, NIR_NARROW, SWIR_1, SWIR_2), 224×224 patches
- **Capabilities:** Semantic segmentation, change detection, regression (e.g., biomass estimation)
- **Versions:**
  - **Prithvi-100M** (Dec 2023) — 100M params, single temporal frame
  - **Prithvi-EO-2.0** (Oct 2024) — 300M params, supports multi-temporal inputs
  - **Prithvi-EO-3.0** (2025) — Weather + EO multimodal
- **HuggingFace:** https://huggingface.co/ibm-nasa-geospatial
- **License:** MIT (open source)
- **Fine-tuning:** For downstream tasks like land cover, crop classification, disaster damage assessment

```python
from transformers import AutoModelForSemanticSegmentation
model = AutoModelForSemanticSegmentation.from_pretrained("ibm-nasa-geospatial/Prithvi-100M")
```

### 2. Clay (Clay Foundation)

**Purpose-built for generating geospatial embeddings.** Uses a Masked Autoencoder (MAE) to learn representations of any location/time on Earth.

- **Architecture:** Vision Transformer + Masked Autoencoder
- **Input:** Multi-platform — Sentinel-2, Landsat 8/9, Sentinel-1 SAR, NAIP, MODIS (6 satellite platforms)
- **Output:** Semantic embeddings (mathematical representations of Earth surface at a given location/time)
- **Key advantage:** Single model handles optical + SAR + aerial data
- **Use cases:** Similarity search, anomaly detection, downstream fine-tuning
- **GitHub:** https://github.com/Clay-foundation/model
- **HuggingFace:** https://huggingface.co/made-with-clay/Clay

```python
# Wall-to-wall processing workflow
from clayfoundation import ClayModel
model = ClayModel.from_pretrained("made-with-clay/Clay")

# 1. Search STAC catalog
# 2. Load imagery via stackstac
# 3. Generate embeddings
embeddings = model.generate_embeddings(data_cube)
# 4. Downstream: PCA reduction, clustering, similarity search
```

### 3. Segment Anything Model (SAM 2/3)

**General-purpose image segmentation, adapted for satellite imagery.**

- **SAM 2** (Meta, 2024): Video-capable, supports point/box/text prompts
- **SAM 3** (Meta, 2025): Major leap for GIS feature extraction from aerial/satellite/drone imagery
- **SamGeo:** Python package specifically for geospatial segmentation with SAM
  - `pip install samgeo`
  - GitHub: https://samgeo.gishub.org
  - Automatically handles GeoTIFF coordinate systems, outputs GeoJSON polygons

```python
from samgeo import SamGeo
sam = SamGeo(model_type="vit_h", automatic=True)
sam.generate("input.tif", output="masks.tif")
sam.show_masks(figsize=(12, 10))
sam.raster_to_vector("masks.tif", "masks.geojson")
```

**For Sentinel:** Wherobots scaled SAM 2 for large-scale satellite prediction (handle full Sentinel-2 tiles, not just small patches). See https://wherobots.com/blog/sam-2-model-geospatial-ai-satellite-imagery/

### 4. TorchGeo (Microsoft)

**PyTorch domain library for geospatial ML** — the "torchvision for satellite data."

- **Datasets:** Built-in loaders for Sentinel-2, Landsat, NAIP, Chesapeake LC, SpaceNet, xBD (disaster damage)
- **Models:** Pre-trained ResNet, ViT on multispectral imagery
- **Samplers:** Spatial intersection/union aware batching
- **Transforms:** Spectral index computation (NDVI, NDWI, NBR), band selection, cloud masking
- **GitHub:** https://github.com/microsoft/torchgeo
- **Docs:** https://torchgeo.readthedocs.io
- **Paper:** "TorchGeo: Deep Learning With Geospatial Data" (ACM, 2024)

```python
from torchgeo.datasets import Sentinel2, NAIP, ChesapeakeDE
from torchgeo.models import ResNet50_Weights
from torchgeo.trainers import SemanticSegmentationTask

# Use pre-trained model
weights = ResNet50_Weights.SENTINEL2_ALL_MOCO
model = weights.get_model()
```

### Model Comparison

| Model | Type | Params | Input | Best For | Open Source |
|---|---|---|---|---|---|
| **Prithvi-EO-2.0** | ViT | 300M | HLS (6 bands) | Segmentation, change detection | ✅ MIT |
| **Clay v1.5** | ViT-MAE | ~100M | Multi-platform (6) | Embeddings, similarity search | ✅ Apache 2.0 |
| **SAM 2/3** | ViT | ~600M-2B | RGB | Feature extraction, object delineation | ✅ Apache 2.0 |
| **TorchGeo ResNet** | CNN | 25M | Multispectral | Semantic segmentation | ✅ MIT |
| **DenseNet** | CNN | ~8M | Multispectral | Land cover classification | ✅ |

---

## ML Task Categories

### 1. Land Cover / Land Use Classification

**What:** Classify each pixel into categories (water, vegetation, urban, bare soil, agriculture, etc.)

**Models:**
- Prithvi fine-tuned for semantic segmentation
- TorchGeo pre-trained models (ResNet50, ViT)
- DenseNet (strong accuracy in challenging scenarios per IEEE 2024 study)
- U-Net architectures (ArcGIS pre-trained models for Sentinel-2 and Landsat-8)

**Output for Sentinel:** InfrastructureAsset entities (roads, buildings), AgriculturalZone entities, WaterBody entities

### 2. Change Detection

**What:** Compare two images of the same area at different times to identify what changed.

**Sub-tasks:**
- **Binary change detection:** Changed vs. unchanged
- **Semantic change detection:** What type of change (urban expansion, deforestation, flooding, fire damage)
- **Multi-class building damage:** xBD-style 4-class ordinal (no damage, minor, major, destroyed)

**Models:**
- Prithvi-EO multi-temporal input (t1, t2)
- siamese networks (two-stream CNNs)
- Transformer-based change detection (ChangeFormer, STANet)
- **STURM-Flood** dataset for flood extent mapping
- University of Osaka model (2025) — rapid building damage assessment after floods

**Output for Sentinel:** HazardEvent entities (flood extent, fire scar, deforestation), InfrastructureDamage entities

### 3. Object Detection

**What:** Detect and localize specific objects (buildings, vehicles, ships, aircraft, solar panels, roads).

**Models:**
- SAM 2/3 with fine-tuning (prompt-based detection)
- YOLOv8/v9 adapted for satellite imagery
- Faster R-CNN with anchor tuning for aerial/satellite scales
- SpaceNet competition models (building footprint extraction)

**Output for Sentinel:** Aircraft, Vessel, Vehicle entities with precise coordinates

### 4. Anomaly Detection

**What:** Identify areas that deviate from expected patterns (unusual activity, environmental anomalies).

**Approach:**
- Generate embeddings with Clay foundation model
- Compute distance from training distribution
- Flag outliers as anomalies
- Can be combined with time-series for temporal anomaly detection

**Output for Sentinel:** AnomalyAlert entities, feeding the GSE risk model

### 5. Flood / Disaster Mapping

**What:** Rapidly map flood inundation, fire spread, earthquake damage from pre/post satellite imagery.

**Key resources:**
- **NASA FIRMS:** Active fire/hotspot data (near real-time)
- **Copernicus EMS:** Rapid Mapping activations
- **Sentinel-1 SAR:** Penetrates clouds — essential for flood mapping in all weather
- **Sentinel-2 optical:** Higher resolution for post-event damage assessment
- **STURM-Flood dataset:** Curated DL-ready flood extent data
- **xBD dataset:** 850K+ building polygons across 22K images, 45K km², multi-class damage

**Pipeline:**
1. Trigger on disaster event (FIRMS, EONET, news)
2. Retrieve pre-event imagery (STAC search)
3. Retrieve post-event imagery ( Sentinel-1 SAR for immediate, Sentinel-2 optical when available)
4. Run change detection model
5. Generate flood/damage polygons
6. Load into Foundry as HazardEvent + InfrastructureDamage entities
7. Feed GSE model for risk escalation

---

## Inference Infrastructure

### NVIDIA Triton Inference Server

**Production-grade model serving** — supports PyTorch, TensorRT, ONNX, TensorFlow, OpenVINO from a single server.

- **Key features:** Dynamic batching, concurrent model execution, model ensembles, multi-GPU support
- **Docker:** `nvcr.io/nvidia/tritonserver:<version>-py3`
- **gRPC + REST** endpoints
- **Protocol:** `.pbtxt` model repository config

```yaml
# docker-compose addition for Triton
ml-inference:
  image: nvcr.io/nvidia/tritonserver:24.01-py3
  container_name: sentinel-ml-inference
  ports:
    - "8000:8000"   # HTTP
    - "8001:8001"   # gRPC
    - "8002:8002"   # Metrics
  volumes:
    - ./ml-models:/models
  command: tritonserver --model-repository=/models
  deploy:
    resources:
      reservations:
        devices:
          - capabilities: ["gpu"]
  networks:
    - sentinel
```

### AWS SageMaker Alternatives

- **SageMaker Processing Jobs:** For batch embedding generation
- **SageMaker Endpoints:** For real-time inference
- **SageMaker Serverless:** For intermittent workloads
- **Cost:** ~$0.05/hr (CPU) to $1.50/hr (GPU) for inference endpoints

### On-Device (Mac mini / Edge)

- **PyTorch MPS:** Apple Silicon GPU acceleration (metal-performance-shaders)
- **Core ML:** Convert models to `.mlmodel` for on-device inference
- **Limitation:** Mac mini 16GB is fine for inference, not training. Use cloud for training, local for inference.

---

## Pipeline Architecture

### End-to-End Architecture for TerraCube Sentinel

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA INGESTION LAYER                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  STAC    │  │  NASA    │  │  Coperni-│  │  AIS / ADS-B /  │ │
│  │  Search  │  │  FIRMS   │  │  cus EMS │  │  TLE / EONET    │ │
│  │ (pystac) │  │  (fire)  │  │ (rapid)  │  │  (live tracking)│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬─────────┘ │
│       │              │             │                 │           │
│       └──────────────┴─────────────┴─────────────────┘           │
│                              │                                    │
│                    ┌─────────▼─────────┐                         │
│                    │    Dagster         │                         │
│                    │    Orchestration   │                         │
│                    │  (schedules,       │                         │
│                    │   sensors,         │                         │
│                    │   partitions)      │                         │
│                    └─────────┬─────────┘                         │
└──────────────────────────────┼──────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│  Satellite   │   │   ML Inference   │   │  Live Data   │
│  Imagery     │   │   Service        │   │  Ingestion   │
│  Download    │   │  (Triton/PyTorch)│   │  (direct)    │
│  (COGs/S3)   │   │                  │   │              │
└──────┬───────┘   ├──────────────────┤   └──────┬───────┘
       │           │ • Prithvi (seg)  │          │
       │           │ • Clay (embed)   │          │
       │           │ • SAM (detect)   │          │
       │           │ • Flood model    │          │
       │           └────────┬─────────┘          │
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  Open Foundry    │
                   │  (Ontology +     │
                   │   GraphQL API)   │
                   │                  │
                   │  Entities:       │
                   │  • HazardEvent   │
                   │  • Infrastructure│
                   │  • LandCover     │
                   │  • AnomalyAlert  │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │  AI Agents       │
                   │  (FastAPI)       │
                   │                  │
                   │  • GSE scoring   │
                   │  • Threat assess │
                   │  • Briefing gen  │
                   │  • Alert routing  │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │  Frontend        │
                   │  (React/Cesium)  │
                   │                  │
                   │  • Map overlay   │
                   │  • Ontology viz  │
                   │  • Dashboards    │
                   └─────────────────┘
```

### Dagster Asset Graph (Recommended)

```
stac_search_items          # Search STAC catalog for new scenes
    │
    ├──► download_cog_assets   # Download specific bands from S3
    │       │
    │       ├──► compute_spectral_indices   # NDVI, NDWI, NBR
    │       │       │
    │       │       └──► detect_anomalies   # Compare against baseline
    │       │               │
    │       │               └──► [Foundry: AnomalyAlert]
    │       │
    │       ├──► run_land_cover_model      # Prithvi/TorchGeo segmentation
    │       │       │
    │       │       ├──► [Foundry: LandCoverClassification]
    │       │       └──► detect_land_cover_change   # Compare with previous
    │       │               │
    │       │               └──► [Foundry: InfrastructureAsset (updated)]
    │       │
    │       ├──► run_change_detection       # Pre/post event comparison
    │       │       │
    │       │       └──► [Foundry: HazardEvent (flood/fire/damage)]
    │       │
    │       ├──► run_object_detection       # SAM 2 fine-tuned
    │       │       │
    │       │       └──► [Foundry: Aircraft, Vessel, Building]
    │       │
    │       └──► generate_embeddings        # Clay foundation model
    │               │
    │               └──► [Valkey: similarity cache]
    │
    ├──► fire_detection            # NASA FIRMS → [Foundry: HazardEvent]
    ├──► satellite_pass_tracking   # TLE → [Foundry: SatellitePass]
    └──► vessel_tracking           # AIS → [Foundry: Vessel]
```

---

## Reference Implementations

### 1. Satellite Vision Pipeline (2-BrainCells)
- **GitHub:** https://github.com/2-BrainCells/satellite-vision-pipeline
- **Stack:** FastAPI + PostgreSQL/PostGIS + Leaflet + AWS Earth Search STAC
- **Features:** VQA (Visual Question Answering), SAR/Optical fusion, change detection, GeoJSON output
- **Architecture:** User draws AOI → STAC query → ML processing → GeoJSON overlay
- **License:** MIT
- **Relevance:** Closest to what Sentinel needs — demonstrates the full frontend-to-STAC-to-ML-to-visualization loop

### 2. TerraSight
- **GitHub:** https://github.com/SakshamSrivasta/TerraSight
- **Stack:** Multispectral VLM + 3D map research assistant
- **Features:** Multi-spectral vision-language model, interactive 3D map, ISRO challenge solution
- **Relevance:** Shows how to integrate VLMs with geospatial data for natural language querying

### 3. BASF Digital Farming (AWS)
- **Blog:** https://aws.amazon.com/blogs/architecture/basf-digital-farming-builds-a-stac-based-solution-on-amazon-eks/
- **Stack:** Amazon EKS + STAC + S3
- **Scale:** Manages petabytes of satellite, drone, and application data
- **Key insight:** New data sources onboarded in weeks, not months, with standardized STAC metadata

### 4. AWS ML with Satellite Data
- **Guide:** https://aws.amazon.com/solutions/guidance/running-machine-learning-algorithms-with-satellite-data-on-aws/
- **Stack:** AWS Ground Station → S3 → SageMaker → DynamoDB
- **Architecture:** Event-driven (S3 triggers Lambda for processing)
- **Key insight:** Automate processing via S3 events rather than scheduled batches

---

## Training Datasets & Benchmarks

### Land Cover
- **ESA WorldCover (2020/2021):** 10m global land cover, 11 classes
- **NLCD (USGS):** 30m US land cover, updated yearly
- **Chesapeake Land Cover:** 1m resolution, 7 classes (TorchGeo built-in)

### Change Detection
- **LEVIR-CD:** Building change detection, 10,071 image pairs
- **WHU-CD:** Building change detection, 2 datasets (building & urban)
- **SYSU-CD:** Multi-temporal change detection, 20,000 pairs

### Disaster Damage
- **xBD:** 850K+ building polygons, 22K images, 45K km², multi-class ordinal damage (no/minor/major/destroyed)
- **Benchmark:** https://roc-hci.github.io/NADBenchmarks/
- **STURM-Flood:** Curated flood extent mapping dataset

### Object Detection
- **SpaceNet:** Building footprint extraction, multiple cities
- **xView:** 60 object classes in overhead imagery
- **DOTA:** Object detection in aerial images, 15 categories
- **FAIR1M:** Fine-grained object detection, 37 categories

### Pre-trained Model Packages
- **ArcGIS Living Atlas:** Deep Learning Packages (`.dlpk`) for disaster response, land cover, feature extraction
  - Search "dlpk" in Living Atlas
  - Works in ArcGIS Pro, Enterprise, and Online
- **HuggingFace ibm-nasa-geospatial:** Prithvi model family
- **HuggingFace made-with-clay:** Clay foundation model

---

## Integration with TerraCube Sentinel

### Current State
- **Dagster pipelines** already have: STAC search, COG download, satellite ingestion, spectral index computation, LLM classification
- **Open Foundry** ontology schema (`geo-sentinel` domain pack) already defines: HazardEvent, Aircraft, Vessel, SatellitePass, InfrastructureAsset, Sensor
- **Agents** already consume Foundry entities for GSE scoring and briefings
- **Frontend** already visualizes entities on 2D/3D maps

### What's Missing (The Gap)

1. **ML Inference Service** — No model serving container. Need Triton or equivalent.
2. **Pre-trained Models** — No downloaded/fine-tuned model weights. Need to train or fine-tune.
3. **Embedding Pipeline** — No foundation model integration (Clay/Prithvi).
4. **Change Detection Pipeline** — No pre/post comparison logic.
5. **Real-time Triggering** — Dagster schedules exist but need event-driven triggers (FIRMS fire alerts, EONET hazard events).

### Recommended Implementation Order

**Phase 1: Data + Embeddings (Week 1-2)**
1. Add Clay foundation model to ML inference container
2. Create Dagster asset: `generate_embeddings` — takes downloaded COGs, produces embeddings via Clay
3. Store embeddings in Valkey (similarity cache) for fast nearest-neighbor search
4. Add `detect_anomalies` asset — compare new embeddings against historical baseline

**Phase 2: Classification (Week 2-4)**
1. Fine-tune Prithvi on Chesapeake/ESA WorldCover data for land cover segmentation
2. Create `run_land_cover_model` Dagster asset
3. Output LandCoverClassification entities to Foundry
4. Add `detect_land_cover_change` — compare with previous classification

**Phase 3: Disaster Response (Week 4-6)**
1. Fine-tune change detection model on xBD dataset for building damage
2. Create event-driven trigger: FIRMS fire alert → fetch Sentinel-2 post-event → run damage model
3. Create `run_change_detection` Dagster asset
4. Output HazardEvent + InfrastructureDamage entities to Foundry
5. Connect to GSE model for automatic risk escalation

**Phase 4: Object Detection (Week 6-8)**
1. Fine-tune SAM 2 for satellite-specific object detection (buildings, vehicles)
2. Create `run_object_detection` Dagster asset
3. Populate Aircraft, Vessel, Building entities automatically from imagery

**Phase 5: VLM Integration (Week 8+)**
1. Add vision-language model for natural language querying ("show me flooded areas in Bangladesh")
2. Integrate with agents layer for conversational intelligence briefings

---

## Cost & Infrastructure

### Training Costs (AWS)

| Resource | Specs | Cost/Hr | Typical Job Duration | Cost |
|---|---|---|---|---|
| SageMaker GPU (ml.g4dn.xlarge) | 1x T4, 16GB | $0.52 | 4-8 hrs (fine-tune Prithvi) | ~$2-4 |
| SageMaker GPU (ml.p3.2xlarge) | 1x V100, 32GB | $3.06 | 12-24 hrs (train from scratch) | ~$37-73 |
| SageMaker CPU (ml.m5.xlarge) | 4 vCPU, 16GB | $0.23 | 1-2 hrs (preprocessing) | ~$0.5 |
| S3 Storage | COGs, models | $0.023/GB/mo | ~500GB | ~$12/mo |

### Inference Costs

| Resource | Specs | Cost | Throughput |
|---|---|---|---|
| Triton on GPU (T4) | 1x T4 | $0.52/hr | ~50-100 inferences/sec |
| Triton on CPU | ml.m5.xlarge | $0.23/hr | ~5-10 inferences/sec |
| Mac mini (M1/M2) | MPS | $0 (local) | ~10-20 inferences/sec |

### Open Data — Free
All STAC-accessible data (Sentinel-2, Landsat, Copernicus DEM, FIRMS) is free. S3 data transfer within AWS is free. COG range reads are minimal bandwidth.

---

## References

### Papers
- "TorchGeo: Deep Learning With Geospatial Data" — Stewart et al., ACM Computing Surveys, 2024
- "Prithvi-EO: An Open-Access Geospatial Foundation Model" — IBM/NASA, 2024
- "Generalizable Disaster Damage Assessment via Change Detection with Foundation Models" — arXiv 2406.08020
- "Advancing Earth Observation Through Machine Learning: A TorchGeo Tutorial" — arXiv 2603.02386
- "Segment Anything for Satellite Imagery" — arXiv 2506.16318

### AWS
- [Running ML with Satellite Data on AWS](https://aws.amazon.com/solutions/guidance/running-machine-learning-algorithms-with-satellite-data-on-aws/)
- [Building Hybrid Satellite Imagery Processing Pipelines](https://aws.amazon.com/blogs/publicsector/building-hybrid-satellite-imagery-processing-pipelines-aws/)
- [Earth Search STAC API](https://element84.com/earth-search)
- [Sentinel-2 COGs on AWS](https://registry.opendata.aws/sentinel-2-l2a-cogs/)

### Models & Libraries
- [Prithvi on HuggingFace](https://huggingface.co/ibm-nasa-geospatial)
- [Clay Foundation Model](https://github.com/Clay-foundation/model)
- [TorchGeo](https://github.com/microsoft/torchgeo)
- [SamGeo](https://samgeo.gishub.org)
- [pystac-client](https://pystac-client.readthedocs.io)
- [NVIDIA Triton](https://github.com/triton-inference-server/server)

### Datasets
- [xBD Disaster Damage](https://roc-hci.github.io/NADBenchmarks/)
- [STURM-Flood](https://doi.org/10.1080/20964471.2025.2458714)
- [ESA WorldCover](https://worldcover2020.esa.int)
- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov)
- [ArcGIS Living Atlas DLPK](https://www.esri.com/arcgis-blog/products/arcgis/imagery/pretrained-land-cover-models)

### Reference Architectures
- [Satellite Vision Pipeline](https://github.com/2-BrainCells/satellite-vision-pipeline)
- [TerraSight VLM](https://github.com/SakshamSrivasta/TerraSight)
- [BASF STAC on EKS](https://aws.amazon.com/blogs/architecture/basf-digital-farming-builds-a-stac-based-solution-on-amazon-eks/)
- [Geospatial Data Orchestration with Dagster](https://u11d.com/blog/geospatial-data-orchestration/)
