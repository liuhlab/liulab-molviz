import re

import pytest

from molviz._runtime import check

GOOD = {"name": "pUC19", "circular": True, "bases": "GATCcatgRYN"}


def test_a_good_record_passes() -> None:
    check(GOOD)


def test_a_bad_record_raises_the_viewers_message() -> None:
    message = (
        'bases: has "X" at index 3, which is not an IUPAC nucleotide letter\ncolour: unknown key'
    )
    with pytest.raises(ValueError, match=f"^{re.escape(message)}$"):
        check({**GOOD, "bases": "ACGX", "colour": "red"})


def test_a_proto_key_is_a_key_not_a_prototype() -> None:
    with pytest.raises(ValueError, match=r"^__proto__: unknown key$"):
        check({**GOOD, "__proto__": None})
