import re

import pytest

from molviz._runtime import check


def test_a_good_record_passes() -> None:
    check({"name": "pUC19", "circular": True, "bases": "GATCcatgRYN"})


def test_a_bad_record_raises_the_viewers_message() -> None:
    message = (
        'bases: has "X" at index 3, which is not an IUPAC nucleotide letter\ncolour: unknown key'
    )
    with pytest.raises(ValueError, match=f"^{re.escape(message)}$"):
        check({"name": "pUC19", "circular": True, "bases": "ACGX", "colour": "red"})
