import re

from comfy_api.latest import ComfyExtension, io

_SLOT_RE = re.compile(r"^Input(\d+)$")
_MAX_INPUTS = 1024  # schema ceiling only; the JS sets the real max = connected count


class MagikSimpleSwitch(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="Magik.SimpleSwitch",
            display_name="Magik Simple Switch",
            category="Magik/Util",
            description="Outputs TRUE when the boolean is on, FALSE when it is off. "
                        "Only the selected branch is evaluated.",
            inputs=[
                io.AnyType.Input("TRUE", lazy=True),
                io.AnyType.Input("FALSE", lazy=True),
                io.Boolean.Input("switch", default=True, label_on="TRUE", label_off="FALSE"),
            ],
            outputs=[io.AnyType.Output(display_name="output")],
        )

    @classmethod
    def check_lazy_status(cls, switch, TRUE=None, FALSE=None):
        if switch:
            return ["TRUE"] if TRUE is None else []
        return ["FALSE"] if FALSE is None else []

    @classmethod
    def execute(cls, switch, TRUE=None, FALSE=None):
        return io.NodeOutput(TRUE if switch else FALSE)


class MagikMultiSwitch(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="Magik.MultiSwitch",
            display_name="Magik Multi Switch",
            category="Magik/Util",
            description="Outputs the Nth connected input. Input slots are added "
                        "dynamically by the frontend (Input1, Input2, ...).",
            accept_all_inputs=True,
            inputs=[
                io.Int.Input("index", default=1, min=1, max=_MAX_INPUTS),
            ],
            outputs=[io.AnyType.Output(display_name="output")],
        )

    @classmethod
    def execute(cls, index, **kwargs):
        slots = []
        for key, value in kwargs.items():
            m = _SLOT_RE.match(key)
            if m and value is not None:
                slots.append((int(m.group(1)), value))
        if not slots:
            raise ValueError("Magik Multi Switch: no inputs connected.")
        slots.sort(key=lambda s: s[0])
        index = max(1, min(int(index), len(slots)))
        return io.NodeOutput(slots[index - 1][1])


class MagikSwitchExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [MagikSimpleSwitch, MagikMultiSwitch]


async def comfy_entrypoint() -> MagikSwitchExtension:
    return MagikSwitchExtension()
