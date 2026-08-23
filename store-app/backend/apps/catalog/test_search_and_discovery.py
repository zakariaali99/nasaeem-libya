"""Tests for Arabic Search Normalization, Transliteration, Predictive Search & Fragrance Finder.
"""

import pytest
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product
from apps.catalog.search_service import (
    expand_search_terms,
    find_fragrance_recommendations,
    normalize_arabic_text,
    perform_predictive_search,
)


@pytest.mark.django_db
class TestArabicNormalizationAndTransliteration:
    def test_arabic_text_normalization(self):
        raw_text = "عُطُورٌ شَرْقِيَّةٌ أَنِيقَةٌ فِى دَارِ آلِ عَمْرٍو"
        normalized = normalize_arabic_text(raw_text)
        assert "عطور" in normalized
        assert "شرقيه" in normalized
        assert "انيقه" in normalized
        assert "في" in normalized
        assert "ال" in normalized

    def test_bilingual_expansion(self):
        terms = expand_search_terms("dior")
        assert any("ديور" in t for t in terms)

        oud_terms = expand_search_terms("عود")
        assert any("oud" in t for t in oud_terms)


@pytest.mark.django_db
class TestPredictiveSearchAndDiscovery:
    def setup_method(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="عطور العود الملكية", slug="royal-oud-cat")
        self.product1 = Product.objects.create(
            name="عطر رويال عود إنتنس",
            slug="royal-oud-intense",
            price="350.00",
            sku="RO-001",
            is_active=True,
        )
        self.product1.categories.add(self.category)

        self.product2 = Product.objects.create(
            name="عطر ديور سوفاج أو دو بارفيوم",
            slug="dior-sauvage-edp",
            price="420.00",
            sku="DS-002",
            is_active=True,
        )

    def test_empty_query_returns_trending_keywords(self):
        response = self.client.get("/api/search/predictive/")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data["trending_keywords"]) > 0
        assert "عود ملكي فاخر" in data["trending_keywords"]

    def test_predictive_search_finds_arabic_and_english_matches(self):
        # Search by Arabic
        response = self.client.get("/api/search/predictive/?q=عود")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data["products"]) >= 1
        assert data["products"][0]["name"] == "عطر رويال عود إنتنس"

        # Search by Latin brand transliteration "dior"
        response_dior = self.client.get("/api/search/predictive/?q=dior")
        assert response_dior.status_code == 200
        dior_data = response_dior.json()["data"]
        assert len(dior_data["products"]) >= 1
        assert "ديور" in dior_data["products"][0]["name"]

    def test_fragrance_finder_recommendations(self):
        response = self.client.post(
            "/api/fragrance-finder/",
            {
                "gender": "MEN",
                "vibe": "ORIENTAL",
                "occasion": "EVENING",
                "budget": "500",
            },
            format="json",
        )
        assert response.status_code == 200
        recommendations = response.json()["data"]
        assert len(recommendations) >= 1
        assert "reason" in recommendations[0]
        assert "match_score" in recommendations[0]
        assert recommendations[0]["match_score"] >= 90
