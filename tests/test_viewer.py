from molviz import viewer_script


def test_the_viewer_script_defines_the_molviz_global() -> None:
    assert viewer_script().startswith("var molviz=")
