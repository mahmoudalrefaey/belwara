"""
Merchant and item pools for generated eval users.

DEV is used while building; HOLDOUT is disjoint (no shared merchant or item) and only runs at
phase gates. Each pool contains "hard negatives": different merchants that share a word, so
matching has to tell them apart instead of grabbing anything similar.

Item tuple: (name, other names people use for it, typical unit price, sold by weight).
"""

from dataclasses import dataclass, field
from typing import List, Tuple

Item = Tuple[str, Tuple[str, ...], float, bool]


@dataclass(frozen=True)
class Merchant:
    key: str
    name: str                     # as printed on the receipt
    category: str
    aliases: Tuple[str, ...] = ()  # how people refer to it otherwise (other script, short form)
    items: List[Item] = field(default_factory=list)
    tax_rate: float = 0.0          # share of subtotal added as tax
    service: float = 0.0           # share of subtotal added as service charge


DEV: List[Merchant] = [
    Merchant("fathalla", "فتح الله ماركت", "groceries", ("Fathalla", "فتح الله"), [
        ("لبن جهينة 1 لتر", ("لبن", "Milk"), 38.0, False),
        ("رز الضحى 1 كجم", ("رز", "Rice"), 42.0, False),
        ("طماطم", ("Tomatoes",), 18.0, True),
        ("زيت عباد الشمس", ("زيت", "Oil"), 95.0, False),
        ("عيش فينو", ("عيش", "Bread"), 2.5, False),
    ]),
    Merchant("seoudi", "Seoudi Market", "groceries", ("سعودي ماركت", "سعودي"), [
        ("Greek Yogurt", ("زبادي", "yoghurt"), 32.0, False),
        ("Bananas", ("موز",), 30.0, True),
        ("Eggs 30", ("بيض", "eggs"), 165.0, False),
    ]),
    Merchant("kebda_alaa", "كبدة علاء", "dining", ("Kebda Alaa",), [
        ("ساندوتش كبدة", ("كبدة", "liver sandwich"), 25.0, False),
        ("ساندوتش سجق", ("سجق", "sausage sandwich"), 22.0, False),
        ("بيبسي", ("Pepsi", "بيبسى"), 15.0, False),
    ]),
    Merchant("halawany_alaa", "حلواني علاء", "dining", ("Halawany Alaa",), [
        ("بسبوسة", ("Basbousa",), 60.0, True),
        ("كنافة", ("Konafa", "كنافه"), 90.0, True),
    ]),
    Merchant("salam_bakery", "مخبز السلام", "groceries", ("Al Salam Bakery",), [
        ("عيش بلدي", ("عيش", "baladi bread"), 1.0, False),
        ("قرص بالعجوة", ("Agwa cookies",), 70.0, True),
    ]),
    Merchant("salam_pharmacy", "صيدلية السلام", "health", ("Al Salam Pharmacy",), [
        ("بنادول اكسترا", ("Panadol", "بانادول"), 55.0, False),
        ("فيتامين سي", ("Vitamin C",), 120.0, False),
    ]),
    Merchant("cilantro", "Cilantro Cafe", "dining", ("سيلانترو",), [
        ("Iced Latte", ("لاتيه", "latte"), 95.0, False),
        ("Croissant", ("كرواسون",), 60.0, False),
    ], tax_rate=0.14, service=0.12),
    Merchant("uber", "Uber Trip", "transport", ("اوبر", "Uber"), [
        ("Trip fare", ("مشوار",), 120.0, False),
    ]),
    Merchant("vodafone", "Vodafone Egypt", "bills", ("فودافون",), [
        ("Monthly bill", ("فاتورة الموبايل",), 350.0, False),
    ], tax_rate=0.14),
    Merchant("panda", "هايبر بنده", "groceries", ("Panda", "بنده"), [
        ("دجاج طازج", ("فراخ", "chicken"), 24.0, True),
        ("تمر سكري", ("تمر", "dates"), 35.0, True),
    ], tax_rate=0.15),
    Merchant("jarir", "مكتبة جرير", "shopping", ("Jarir Bookstore", "جرير"), [
        ("دفتر ملاحظات", ("notebook",), 25.0, False),
        ("سماعات لاسلكية", ("earbuds", "headphones"), 299.0, False),
    ], tax_rate=0.15),
    Merchant("fnac", "FNAC Paris", "shopping", ("فناك",), [
        ("Livre de poche", ("book", "كتاب"), 9.9, False),
        ("Casque audio", ("headphones",), 79.0, False),
    ], tax_rate=0.2),
    Merchant("emirates_coop", "Union Coop", "groceries", ("يونيون كوب",), [
        ("Labneh", ("لبنة",), 14.0, False),
        ("Arabic Coffee", ("قهوة عربي",), 32.0, False),
    ], tax_rate=0.05),
]

HOLDOUT: List[Merchant] = [
    Merchant("oscar", "أوسكار جراند ستورز", "groceries", ("Oscar", "اوسكار"), [
        ("جبنة رومي", ("رومي", "Roumi cheese"), 260.0, True),
        ("مكرونة ريجاتا", ("مكرونة", "pasta"), 22.0, False),
        ("سكر 1 كجم", ("سكر", "sugar"), 36.0, False),
    ]),
    Merchant("gourmet", "Gourmet Egypt", "groceries", ("جورميه",), [
        ("Smoked Salmon", ("سالمون",), 410.0, False),
        ("Sourdough Loaf", ("عيش ساوردو",), 85.0, False),
    ]),
    Merchant("koshary_hend", "كشري هند", "dining", ("Koshary Hend",), [
        ("كشري وسط", ("كشري", "koshary"), 45.0, False),
        ("أرز بلبن", ("رز بلبن", "rice pudding"), 25.0, False),
    ]),
    Merchant("fool_hend", "فول وطعمية هند", "dining", ("Foul Hend",), [
        ("ساندوتش فول", ("فول",), 12.0, False),
        ("طعمية", ("فلافل", "falafel"), 3.0, False),
    ]),
    Merchant("nour_clinic", "عيادة النور", "health", ("Al Nour Clinic",), [
        ("كشف", ("checkup", "consultation"), 400.0, False),
    ]),
    Merchant("nour_optics", "نظارات النور", "shopping", ("Al Nour Optics",), [
        ("عدسات لاصقة", ("contact lenses",), 650.0, False),
    ]),
    Merchant("costa", "Costa Coffee", "dining", ("كوستا",), [
        ("Flat White", ("فلات وايت",), 105.0, False),
        ("Blueberry Muffin", ("مافن",), 75.0, False),
    ], tax_rate=0.14),
    Merchant("careem", "Careem Ride", "transport", ("كريم",), [
        ("Ride", ("مشوار",), 95.0, False),
    ]),
    Merchant("we", "WE Internet", "bills", ("وي", "المصرية للاتصالات"), [
        ("Home internet", ("النت",), 420.0, False),
    ], tax_rate=0.14),
    Merchant("othaim", "أسواق العثيم", "groceries", ("Othaim",), [
        ("أرز بسمتي", ("رز بسمتي", "basmati"), 48.0, False),
        ("خيار", ("cucumber",), 7.0, True),
    ], tax_rate=0.15),
    Merchant("extra", "اكسترا للإلكترونيات", "shopping", ("eXtra",), [
        ("شاحن سريع", ("charger",), 89.0, False),
    ], tax_rate=0.15),
    Merchant("primark", "Primark Madrid", "shopping", ("بريمارك",), [
        ("Camiseta", ("t-shirt", "تيشيرت"), 6.0, False),
    ], tax_rate=0.21),
    Merchant("lulu", "LuLu Hypermarket", "groceries", ("لولو",), [
        ("Basmati Rice 5kg", ("رز",), 45.0, False),
        ("Fresh Milk", ("حليب",), 7.5, False),
    ], tax_rate=0.05),
]

# Currency each region's merchants charge in.
REGION_CURRENCY = {
    "fathalla": "EGP", "seoudi": "EGP", "kebda_alaa": "EGP", "halawany_alaa": "EGP",
    "salam_bakery": "EGP", "salam_pharmacy": "EGP", "cilantro": "EGP", "uber": "EGP",
    "vodafone": "EGP", "panda": "SAR", "jarir": "SAR", "fnac": "EUR", "emirates_coop": "AED",
    "oscar": "EGP", "gourmet": "EGP", "koshary_hend": "EGP", "fool_hend": "EGP",
    "nour_clinic": "EGP", "nour_optics": "EGP", "costa": "EGP", "careem": "EGP", "we": "EGP",
    "othaim": "SAR", "extra": "SAR", "primark": "EUR", "lulu": "AED",
}

POOLS = {"dev": DEV, "holdout": HOLDOUT}
