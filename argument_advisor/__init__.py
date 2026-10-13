"""Public API for the AIdeator Argument Advisor."""

from .advisor import (
    SCHEMES,
    ArgumentAdvisor,
    ArgumentAdvisorError,
    advise_argument,
    find_node_path,
)

__all__ = [
    "SCHEMES",
    "ArgumentAdvisor",
    "ArgumentAdvisorError",
    "advise_argument",
    "find_node_path",
]

__version__ = "0.1.0"
