"""TerraCube Sentinel Dagster pipelines — geo-hazard monitoring."""

from dagster import Definitions, EnvVar, ScheduleDefinition

from .real_time_hazards import (
    real_time_hazards_job,
    fetch_open_meteo_weather,
    fetch_usgs_earthquakes,
    fetch_nasa_firms_fires,
    fetch_nasa_eonet_events,
    normalize_hazard_records,
    load_hazards_to_foundry,
)
from .satellite_ingestion import (
    satellite_ingestion_job,
    search_stac_catalogs,
    filter_scenes,
    download_cog_assets,
    store_in_minio,
    register_data_products,
)
from .climate_reanalysis import (
    climate_reanalysis_job,
    download_era5_data,
    compute_degree_days,
    compute_anomalies,
    aggregate_to_regions,
    update_risk_assessments,
)
from .infrastructure_vulnerability import (
    infrastructure_vulnerability_job,
    download_osm_data,
    fetch_active_hazards,
    compute_exposure,
    update_infrastructure_assets,
)

# ── Schedules ──────────────────────────────────────────────────────────

hazards_schedule = ScheduleDefinition(
    job=real_time_hazards_job,
    cron_schedule="*/5 * * * *",  # every 5 minutes
    default_status=None,
)

satellite_schedule = ScheduleDefinition(
    job=satellite_ingestion_job,
    cron_schedule="0 */3 * * *",  # every 3 hours
    default_status=None,
)

climate_schedule = ScheduleDefinition(
    job=climate_reanalysis_job,
    cron_schedule="0 6 * * *",  # daily at 06:00 UTC
    default_status=None,
)

infra_schedule = ScheduleDefinition(
    job=infrastructure_vulnerability_job,
    cron_schedule="0 */6 * * *",  # every 6 hours
    default_status=None,
)

# ── Definitions ────────────────────────────────────────────────────────

defs = Definitions(
    assets=[
        fetch_open_meteo_weather,
        fetch_usgs_earthquakes,
        fetch_nasa_firms_fires,
        fetch_nasa_eonet_events,
        normalize_hazard_records,
        load_hazards_to_foundry,
        search_stac_catalogs,
        filter_scenes,
        download_cog_assets,
        store_in_minio,
        register_data_products,
        download_era5_data,
        compute_degree_days,
        compute_anomalies,
        aggregate_to_regions,
        update_risk_assessments,
        download_osm_data,
        fetch_active_hazards,
        compute_exposure,
        update_infrastructure_assets,
    ],
    jobs=[
        real_time_hazards_job,
        satellite_ingestion_job,
        climate_reanalysis_job,
        infrastructure_vulnerability_job,
    ],
    schedules=[
        hazards_schedule,
        satellite_schedule,
        climate_schedule,
        infra_schedule,
    ],
)
