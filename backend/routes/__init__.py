"""Re-exports feature routers so server.py can mount them with one loop.

NOTE: the gateway router is NOT included here — it is mounted explicitly via
`register_gateway(api, limiter)` in server.py because slowapi decorators must wrap
the endpoint functions at registration time.
"""
from .routing import router as routing_router
from .cache import router as cache_router
from .analytics import router as analytics_router
from .budgets import router as budgets_router
from .advisor import router as advisor_router
from .providers import router as providers_router
from .optimization import router as optimization_router
from .actions import router as actions_router
from .meta import router as meta_router

ALL_ROUTERS = [
    meta_router,
    routing_router,
    cache_router,
    analytics_router,
    budgets_router,
    advisor_router,
    providers_router,
    optimization_router,
    actions_router,
]
