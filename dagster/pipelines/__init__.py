from dagster import DefaultScheduleStatus
"""TerraCube Sentinel Dagster pipelines — geo-hazard monitoring."""

from dagster import Definitions, ScheduleDefinition

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
from .air_quality import (
    air_quality_job,
    fetch_openaq_measurements,
    fetch_waqi_status,
    normalize_air_quality,
    load_air_quality_to_foundry,
)
from .social_signals import (
    social_signals_job,
    fetch_gdelt_events,
    fetch_gdelt_tone,
    normalize_social_signals,
)
from .risk_scoring import (
    risk_scoring_job,
    aggregate_hazard_data,
    compute_composite_risk,
    update_region_risk_scores,
)

# ── Schedules ──────────────────────────────────────────────────────────

hazards_schedule = ScheduleDefinition(
    job=real_time_hazards_job,
    cron_schedule="*/5 * * * *",  # every 5 minutes
    default_status=DefaultScheduleStatus.STOPPED,
)

satellite_schedule = ScheduleDefinition(
    job=satellite_ingestion_job,
    cron_schedule="0 */3 * * *",  # every 3 hours
    default_status=DefaultScheduleStatus.STOPPED,
)

climate_schedule = ScheduleDefinition(
    job=climate_reanalysis_job,
    cron_schedule="0 6 * * *",  # daily at 06:00 UTC
    default_status=DefaultScheduleStatus.STOPPED,
)

infra_schedule = ScheduleDefinition(
    job=infrastructure_vulnerability_job,
    cron_schedule="0 */6 * * *",  # every 6 hours
    default_status=DefaultScheduleStatus.STOPPED,
)

air_quality_schedule = ScheduleDefinition(
    job=air_quality_job,
    cron_schedule="*/30 * * * *",  # every 30 minutes
    default_status=DefaultScheduleStatus.STOPPED,
)

social_signals_schedule = ScheduleDefinition(
    job=social_signals_job,
    cron_schedule="*/15 * * * *",  # every 15 minutes
    default_status=DefaultScheduleStatus.STOPPED,
)

risk_scoring_schedule = ScheduleDefinition(
    job=risk_scoring_job,
    cron_schedule="0 * * * *",  # hourly
    default_status=DefaultScheduleStatus.STOPPED,
)

# ── Definitions ────────────────────────────────────────────────────────

defs = Definitions(
    assets=[
        # real_time_hazards
        fetch_open_meteo_weather,
        fetch_usgs_earthquakes,
        fetch_nasa_firms_fires,
        fetch_nasa_eonet_events,
        normalize_hazard_records,
        load_hazards_to_foundry,
        # satellite_ingestion
        search_stac_catalogs,
        filter_scenes,
        download_cog_assets,
        store_in_minio,
        register_data_products,
        # climate_reanalysis
        download_era5_data,
        compute_degree_days,
        compute_anomalies,
        aggregate_to_regions,
        update_risk_assessments,
        # infrastructure_vulnerability
        download_osm_data,
        fetch_active_hazards,
        compute_exposure,
        update_infrastructure_assets,
        # air_quality
        fetch_openaq_measurements,
        fetch_waqi_status,
        normalize_air_quality,
        load_air_quality_to_foundry,
        # social_signals
        fetch_gdelt_events,
        fetch_gdelt_tone,
        normalize_social_signals,
        # risk_scoring
        aggregate_hazard_data,
        compute_composite_risk,
        update_region_risk_scores,
    ],
    jobs=[
        real_time_hazards_job,
        satellite_ingestion_job,
        climate_reanalysis_job,
        infrastructure_vulnerability_job,
        air_quality_job,
        social_signals_job,
        risk_scoring_job,
    ],
    schedules=[
        hazards_schedule,
        satellite_schedule,
        climate_schedule,
        infra_schedule,
        air_quality_schedule,
        social_signals_schedule,
        risk_scoring_schedule,
    ],
)
