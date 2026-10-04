from typing import Any

from .formfield import formfield
from .northline import northline
from .travel import travel
from .types import DemoDefinition

demos: dict[str, DemoDefinition[Any]] = {"northline": northline, "formfield": formfield, "travel": travel}


def is_demo_id(v: object) -> bool:
    return v in demos
