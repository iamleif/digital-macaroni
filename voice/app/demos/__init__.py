from typing import Any

from .agent import agent
from .dealership import dealership
from .formfield import formfield
from .hotels import hotels
from .insurance import insurance
from .lawfirm import lawfirm
from .lune import lune
from .northline import northline
from .realestate import realestate
from .tidewell import tidewell
from .travel import travel
from .types import DemoDefinition

demos: dict[str, DemoDefinition[Any]] = {"northline": northline, "formfield": formfield, "travel": travel, "lawfirm": lawfirm, "hotels": hotels, "realestate": realestate, "insurance": insurance, "lune": lune, "tidewell": tidewell, "dealership": dealership, "agent": agent}


def is_demo_id(v: object) -> bool:
    """A demo a website visitor may start. The generic agent is only started by the factory."""
    return v in demos and v != "agent"
