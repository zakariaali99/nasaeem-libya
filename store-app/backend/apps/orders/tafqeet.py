"""Arabic Number to Words (Tafqeet) for Libyan Dinars and Dirhams.

Converts numeric amounts (e.g. Decimal("145.50")) into formal Arabic financial wording:
"فقط مائة وخمسة وأربعون ديناراً وخمسون درهماً لا غير"
"""

from decimal import Decimal

ONES = [
    "",
    "واحد",
    "اثنان",
    "ثلاثة",
    "أربعة",
    "خمسة",
    "ستة",
    "سبعة",
    "ثمانية",
    "تسعة",
    "عشرة",
    "أحد عشر",
    "اثنا عشر",
    "ثلاثة عشر",
    "أربعة عشر",
    "خمسة عشر",
    "ستة عشر",
    "سبعة عشر",
    "ثمانية عشر",
    "تسعة عشر",
]

TENS = [
    "",
    "عشرة",
    "عشرون",
    "ثلاثون",
    "أربعون",
    "خمسون",
    "ستون",
    "سبعون",
    "ثمانون",
    "تسعون",
]

HUNDREDS = [
    "",
    "مائة",
    "مئتان",
    "ثلاثمائة",
    "أربعمائة",
    "خمسمائة",
    "ستمائة",
    "سبعمائة",
    "ثمانمائة",
    "تسعمائة",
]

THOUSANDS = [
    "",
    "ألف",
    "ألفان",
    "آلاف",
]

MILLIONS = [
    "",
    "مليون",
    "مليونان",
    "ملايين",
]


def _convert_group(number: int) -> str:
    """Convert a 3-digit number (0-999) to Arabic words."""
    if number == 0:
        return ""

    parts = []
    c = number // 100
    r = number % 100

    if c > 0:
        parts.append(HUNDREDS[c])

    if r > 0:
        if r < 20:
            parts.append(ONES[r])
        else:
            ones_digit = r % 10
            tens_digit = r // 10
            if ones_digit > 0:
                parts.append(f"{ONES[ones_digit]} و{TENS[tens_digit]}")
            else:
                parts.append(TENS[tens_digit])

    return " و".join(parts)


def number_to_arabic_words(number: int) -> str:
    """Convert integer to Arabic words up to billions."""
    if number == 0:
        return "صفر"

    if number < 0:
        return f"سالب {number_to_arabic_words(abs(number))}"

    groups = []
    num = number

    # Millions
    millions = num // 1_000_000
    num %= 1_000_000
    if millions > 0:
        if millions == 1:
            groups.append("مليون")
        elif millions == 2:
            groups.append("مليونان")
        elif 3 <= millions <= 10:
            groups.append(f"{_convert_group(millions)} ملايين")
        else:
            groups.append(f"{_convert_group(millions)} مليوناً")

    # Thousands
    thousands = num // 1_000
    num %= 1_000
    if thousands > 0:
        if thousands == 1:
            groups.append("ألف")
        elif thousands == 2:
            groups.append("ألفان")
        elif 3 <= thousands <= 10:
            groups.append(f"{_convert_group(thousands)} آلاف")
        else:
            groups.append(f"{_convert_group(thousands)} ألفاً")

    # Units (0-999)
    if num > 0:
        groups.append(_convert_group(num))

    return " و".join([g for g in groups if g])


def tafqeet_libyan_dinars(amount: Decimal | float | int | str) -> str:
    """Converts amount to formal Libyan Dinar wording.
    
    Example:
        tafqeet_libyan_dinars(420.50) -> "فقط أربعمائة وعشرون ديناراً وخمسون درهماً لا غير"
    """
    try:
        dec = Decimal(str(amount)).quantize(Decimal("0.01"))
    except Exception:
        return "صفر دينار"

    dinars = int(dec)
    dirhams = int(round((dec - dinars) * 1000))  # 1 LYD = 1000 dirhams / 100 piastres

    parts = []
    if dinars > 0:
        dinars_words = number_to_arabic_words(dinars)
        if dinars == 1:
            parts.append("دينار واحد")
        elif dinars == 2:
            parts.append("ديناران")
        elif 3 <= dinars <= 10:
            parts.append(f"{dinars_words} دنانير")
        else:
            parts.append(f"{dinars_words} ديناراً")
    elif dirhams == 0:
        return "صفر دينار"

    if dirhams > 0:
        dirhams_words = number_to_arabic_words(dirhams // 10)  # express as 10s of dirhams or cents
        parts.append(f"{dirhams_words} درهماً")

    result = " و".join(parts)
    return f"فقط {result} لا غير"
