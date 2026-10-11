from typing import Any

from .formfield import formfield
from .hotels import hotels
from .lawfirm import lawfirm
from .northline import northline
from .travel import travel
from .types import DemoDefinition

demos: dict[str, DemoDefinition[Any]] = {"northline": northline, "formfield": formfield, "travel": travel, "lawfirm": lawfirm, "hotels": hotels}


def is_demo_id(v: object) -> bool:
    return v in demos
