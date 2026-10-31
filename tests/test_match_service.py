"""Merchant and item name matching: layered, OCR-aware, never merging different merchants."""

from app.services.match_service import Candidate, cluster_names, match_names, normalize, score, skeleton


def test_normalization_unifies_letter_forms_digits_and_marks():
    assert normalize("إِبْرَاهِيمُ") == normalize("ابراهيم")
    assert normalize("مكتبة") == normalize("مكتبه")
    assert normalize("على") == normalize("علي")
    assert normalize("سـوق ٣٥") == "سوق 35"
    assert normalize("Café  NERO!") == "cafe nero"


def test_skeleton_folds_letters_ocr_confuses():
    assert skeleton("فلاء") == skeleton("علاء")
    assert skeleton("بيت") == skeleton("نبت")
    assert skeleton("rnarket") == skeleton("market")


def test_ocr_damaged_name_matches_and_a_different_shop_does_not():
    damaged, other = score("حواوشي علاء", "حواوشى فلاء")[0], score("حواوشي علاء", "حلواني علاء")[0]
    assert damaged >= 0.9 > 0.8 > other


def test_query_words_the_stored_name_lacks_count_against_it():
    pharmacy = score("صيدليه السلام", "صيدلية السلام")[0]
    bakery = score("صيدليه السلام", "مخبز السلام")[0]
    assert pharmacy > 0.95 and bakery < 0.8
    # A business word the stored name doesn't print is weak evidence against it, not a veto.
    assert score("مطعم كبدة علاء", "كبدة علاء")[0] >= 0.8


def test_partial_names_and_spacing_damage():
    assert score("Seoudi", "Seoudi Market")[1] == "contains"
    assert score("seoudi market", "SeoudiMarket")[0] >= 0.9


def test_variants_of_one_merchant_come_back_together_and_originals_are_kept():
    stored = [("Seoudi Market", 5), ("Se0udi Market", 1), ("SeoudiMarket", 1), ("Fathalla", 3)]
    r = match_names("seoudi", [], stored)
    assert r.status == "ok"
    assert set(r.matched) == {"Seoudi Market", "Se0udi Market", "SeoudiMarket"}
    assert r.groups[0].name == "Seoudi Market"  # the spelling with most receipts leads


def test_a_word_two_merchants_share_is_ambiguous_not_merged():
    r = match_names("علاء", [], [("كبدة علاء", 3), ("حلواني علاء", 2)])
    assert r.status == "ambiguous"
    assert sorted(g.name for g in r.groups) == ["حلواني علاء", "كبدة علاء"]


def test_scope_settles_a_close_call():
    cands = [Candidate("كبدة علاء", 3, in_scope=0), Candidate("حلواني علاء", 2, in_scope=1)]
    r = match_names("علاء", [], cands)
    assert r.status == "ok" and r.matched == ["حلواني علاء"]


def test_items_take_every_match_together():
    r = match_names("لبن", [], [("لبن جهينة 1 لتر", 3), ("لبن المراعي", 1), ("عيش", 4)], union=True)
    assert r.status == "ok" and set(r.matched) == {"لبن جهينة 1 لتر", "لبن المراعي"}


def test_alternatives_cover_another_script_or_word():
    stored = [("Seoudi Market", 2)]
    assert match_names("سعودي ماركت", [], stored).status == "no_results"
    r = match_names("سعودي ماركت", ["Seoudi Market"], stored)
    assert r.status == "ok" and r.method == "alternate"


def test_no_match_offers_nearest_names_only():
    r = match_names("Carrefour", [], [("Carrefur Maadi", 1), ("Metro", 2)])
    assert r.status in ("ok", "no_results")
    r = match_names("Spinneys", [], [("Seoudi Market", 1), ("Metro", 2)])
    assert r.status == "no_results" and r.matched == []


def test_cluster_names_maps_each_spelling_to_its_lead():
    m = cluster_names([("Vodafone Egypt", 4), ("Vodaf0ne Egypt", 1), ("Uber Trip", 2)])
    assert m["Vodaf0ne Egypt"] == "Vodafone Egypt" and m["Uber Trip"] == "Uber Trip"


def test_short_words_need_an_exact_or_look_alike_match():
    r = match_names("لبن", [], [("لبن جهينة", 2), ("لبنة", 1)], union=True)
    assert r.matched == ["لبن جهينة"]  # labneh is a different product, one letter away
