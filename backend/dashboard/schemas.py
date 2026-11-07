from ninja import Schema


class DashboardOut(Schema):
    total_units: int
    vacant_units: int
    occupancy_rate: float
    leads_by_status: dict[str, int]
    conversion_rate: float
