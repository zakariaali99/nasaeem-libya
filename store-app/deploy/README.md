# Deployment

Three processes, plus two data services. **No containers, no Node.**

```
nginx  ->  gunicorn (Django)  ->  PostgreSQL
                              ->  Redis
```

## Host prerequisites

```bash
sudo apt install python3.12 python3.12-venv postgresql redis nginx
sudo -u postgres createuser nasaim --pwprompt
sudo -u postgres createdb nasaim --owner nasaim
sudo -u postgres psql nasaim -c 'CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;'
```

Node is installed **only if you build on the server**. Building on CI or a
developer machine and shipping `dist/` is preferred — then the server has no
Node at all, and `ps aux | grep -c node` returning 0 is trivially true.

## First deploy

```bash
sudo mkdir -p /srv/nasaim && sudo chown nasaim:www-data /srv/nasaim
git clone <repo> /srv/nasaim
cd /srv/nasaim/backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env && $EDITOR .env          # SECRET_KEY, DATABASE_URL, REDIS_URL, ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS
.venv/bin/python manage.py migrate
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py createsuperuser

cd /srv/nasaim/frontend && npm ci && npm run build   # produces dist/

sudo cp /srv/nasaim/deploy/gunicorn.service /etc/systemd/system/nasaim.service
sudo cp /srv/nasaim/deploy/nginx.conf /etc/nginx/sites-available/nasaim
sudo ln -sf /etc/nginx/sites-available/nasaim /etc/nginx/sites-enabled/nasaim
sudo systemctl daemon-reload && sudo systemctl enable --now nasaim
sudo nginx -t && sudo systemctl reload nginx
```

## Subsequent deploys

```bash
cd /srv/nasaim && git pull
cd backend  && .venv/bin/pip install -r requirements.txt \
            && .venv/bin/python manage.py migrate \
            && .venv/bin/python manage.py collectstatic --noinput
cd ../frontend && npm ci && npm run build
sudo systemctl restart nasaim && sudo systemctl reload nginx
```

## Post-deploy verification — each of these can fail

```bash
curl -fsS https://nasaeem.ly/api/health/ | grep -q '"status":"ok"'   # 503 if PG or Redis is down
ps aux | grep -c '[n]ode'                                            # must print 0
test ! -f /srv/nasaim/Dockerfile                                     # Rule 2
curl -fsS https://nasaeem.ly/products/<slug> | grep -q '<title>'      # SPA fallback + SEO
```

## Local development ports

Port 8000 and 5173 are occupied on the current development machine by an
unrelated project, so this project uses **Django on 8010** and **Vite on 5183**
(`vite.config.ts` sets `strictPort: true` so a silent fallback cannot happen
again — a fallback is how a health check once hit a different app's API and
returned a green result that meant nothing). Production still uses 8000 for
gunicorn behind nginx.

## Scheduled job — expired draft release

An unconfirmed checkout draft holds reserved stock for `DRAFT_EXPIRY_MINUTES`
(60, in `apps/orders/services.py`). A lazy sweep also runs inside
add-to-cart/checkout throttled to once per 30 s, but the scheduled pass keeps
availability honest when no one is shopping:

```
# /etc/cron.d/nasaim-drafts
* * * * * zakaria  cd /srv/nasaim/backend && .venv/bin/python manage.py release_expired_drafts >> /var/log/nasaim/drafts.log 2>&1
```
