"""Create `pg_trgm` in the database rather than by hand.

Phase 0 created this extension with a `psql` command typed once on the dev
machine. That is a hidden environment dependency: the pytest database is built
fresh and had no extension, so `SIMILARITY(...)` did not exist and every search
test failed with "No function matches the given name". A migration makes the
requirement travel with the code — to CI, to the test database, and to the
server.

`unaccent` is deliberately NOT created. It is the obvious thing to reach for and
it does nothing useful here — measured, not assumed:

    SELECT unaccent('عِطْر') = 'عطر';  ->  f

Arabic harakat are not accents as far as `unaccent` is concerned. Normalisation
is done explicitly in `apps.catalog.services.search_products` instead.
"""

from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("core", "0002_city_region_useraddress")]

    operations = [TrigramExtension()]
