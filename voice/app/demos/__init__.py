from typing import Any

from .formfield import formfield
from .northline import northline
from .types import DemoDefinition

demos: dict[str, DemoDefinition[Any]] = {"northline": northline, "formfield": formfield}


def is_demo_id(v: object) -> bool:
    return v in demos
