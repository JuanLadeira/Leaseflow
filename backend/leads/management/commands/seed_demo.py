"""Seed a realistic demo dataset: properties, units, ~600 leads with conversations.

Deterministic (fixed random seed) so screenshots and tests are reproducible.
Usage: python manage.py seed_demo [--leads 600] [--reset]
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from leads.models import Lead, Message
from properties.models import Property, Unit
from visits.models import Visit

DEMO_USERNAME = "demo"
DEMO_PASSWORD = "leaseflow123"

PROPERTIES = [
    ("The Mercer Lofts", "120 Mercer St", "New York", "NY"),
    ("Harbor View Residences", "45 Atlantic Ave", "Boston", "MA"),
    ("Pinecrest Commons", "800 Pine St", "Seattle", "WA"),
    ("Sunset Terrace", "2200 Sunset Blvd", "Los Angeles", "CA"),
    ("Riverside Flats", "15 River Rd", "Austin", "TX"),
    ("Maple Court", "77 Maple Ave", "Chicago", "IL"),
    ("Coral Gardens", "390 Ocean Dr", "Miami", "FL"),
    ("Aspen Ridge", "1600 Aspen Way", "Denver", "CO"),
    ("Brickyard Apartments", "52 Foundry Ln", "Portland", "OR"),
    ("Liberty Square", "10 Liberty Pl", "Philadelphia", "PA"),
]

FIRST = "Ava Liam Noah Emma Olivia Mia Lucas Ethan Sofia Isabella Mateo Amelia Leo Chloe "
FIRST += "Daniel Grace Henry Zoe Samuel Layla Julian Nora Gabriel Aria Caleb Maya"
LAST = "Smith Johnson Garcia Brown Davis Martinez Lopez Wilson Anderson Thomas Moore "
LAST += "Clark Lewis Walker Young King Wright Scott Green Baker Adams Nelson Hill Rivera"

OPENERS = [
    "Hi! Is unit {unit} still available? I'm looking to move in around {move_in}.",
    "Hello, I saw the listing for {unit} on {source}. Does it allow pets? I have a small dog.",
    "Hey there, what's included in the rent for {unit}? Is parking available?",
    "Hi, I'd love to schedule a tour of {unit} this week if possible.",
    "Good afternoon. Could you tell me about the application process and lease terms for {unit}?",
    "Hola! ¿El apartamento {unit} sigue disponible? Me interesa mudarme pronto.",
]
AGENT_REPLIES = [
    "Thanks for reaching out! Yes, it's available. Would you like to book a tour?",
    "Great question, let me confirm with the property manager and get back to you today.",
    "Happy to help! I've sent you the application link. Let me know if you have questions.",
]
FOLLOW_UPS = [
    "Thanks! Does Saturday morning work for a tour?",
    "Perfect, I just submitted the application.",
    "Could you also share the utilities cost estimate?",
    "Is there any flexibility on the move-in date?",
]


class Command(BaseCommand):
    help = "Seed demo data for Leaseflow"

    def add_arguments(self, parser):
        parser.add_argument("--leads", type=int, default=600)
        parser.add_argument("--reset", action="store_true")

    @transaction.atomic
    def handle(self, *args, leads: int, reset: bool, **options):
        rng = random.Random(42)
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=DEMO_USERNAME,
            defaults={"email": "demo@leaseflow.dev", "first_name": "Demo", "last_name": "Agent"},
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.is_staff = user.is_superuser = True
            user.save()

        if reset:
            Property.objects.all().delete()
            Lead.objects.all().delete()  # cascades to messages and visits
        elif Property.objects.exists():
            self.stdout.write("Demo data already present (use --reset to recreate).")
            return

        units: list[Unit] = []
        for name, address, city, state in PROPERTIES:
            prop = Property.objects.create(
                name=name,
                address=address,
                city=city,
                state=state,
            )
            for floor in range(1, rng.randint(3, 5) + 1):
                for letter in "ABC"[: rng.randint(2, 3)]:
                    bedrooms = rng.choice([0, 1, 1, 2, 2, 3])
                    status = rng.choices(
                        [Unit.Status.OCCUPIED, Unit.Status.VACANT, Unit.Status.NOTICE],
                        weights=[70, 20, 10],
                    )[0]
                    units.append(
                        Unit(
                            property=prop,
                            label=f"{floor}{letter}",
                            bedrooms=bedrooms,
                            bathrooms=Decimal("1.0") if bedrooms < 2 else Decimal("2.0"),
                            square_feet=450 + bedrooms * 280 + rng.randint(0, 120),
                            rent=Decimal(1200 + bedrooms * 650 + rng.randint(0, 40) * 10),
                            status=status,
                            available_from=date.today() + timedelta(days=rng.randint(0, 60))
                            if status != Unit.Status.OCCUPIED
                            else None,
                        )
                    )
        units = Unit.objects.bulk_create(units)
        available = [u for u in units if u.status != Unit.Status.OCCUPIED] or units

        firsts, lasts = FIRST.split(), LAST.split()
        now = timezone.now()
        statuses = [s for s in Lead.Status]
        lead_objs, convo = [], []
        for _ in range(leads):
            first, last = rng.choice(firsts), rng.choice(lasts)
            unit = rng.choice(available)
            source = rng.choice(list(Lead.Source))
            move_in = date.today() + timedelta(days=rng.randint(7, 90))
            lead_objs.append(
                Lead(
                    full_name=f"{first} {last}",
                    email=f"{first}.{last}{rng.randint(1, 999)}@example.com".lower(),
                    phone=f"+1 555 {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
                    unit=unit,
                    source=source,
                    status=rng.choices(statuses, weights=[30, 25, 15, 12, 10, 8])[0],
                    desired_move_in=move_in,
                    budget=Decimal(int(unit.rent) + rng.randint(-3, 5) * 100),
                )
            )
            convo.append((unit, source, move_in, rng.randint(1, 4)))
        lead_objs = Lead.objects.bulk_create(lead_objs)

        messages = []
        for lead, (unit, source, move_in, n_messages) in zip(lead_objs, convo, strict=True):
            opener = rng.choice(OPENERS).format(
                unit=unit.label, move_in=move_in.strftime("%B %d"), source=source.label
            )
            bodies = [(Message.Direction.INBOUND, opener)]
            for k in range(1, n_messages):
                if k % 2:
                    bodies.append((Message.Direction.OUTBOUND, rng.choice(AGENT_REPLIES)))
                else:
                    bodies.append((Message.Direction.INBOUND, rng.choice(FOLLOW_UPS)))
            messages += [Message(lead=lead, direction=d, body=b) for d, b in bodies]
        Message.objects.bulk_create(messages)

        # Spread activity over the last 30 days so the inbox ordering looks real.
        for lead in lead_objs:
            lead.last_activity_at = now - timedelta(minutes=rng.randint(0, 60 * 24 * 30))
        Lead.objects.bulk_update(lead_objs, ["last_activity_at"])

        visits = self._seed_visits(rng, user, lead_objs)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(PROPERTIES)} properties, {len(units)} units, {len(lead_objs)} leads, "
                f"{len(messages)} messages, {len(visits)} visits. "
                f"Login: {DEMO_USERNAME} / {DEMO_PASSWORD}"
            )
        )

    def _seed_visits(self, rng: random.Random, agent, leads: list[Lead]) -> list[Visit]:
        """Tours for leads at the `tour_scheduled` stage over the next two weeks (from tomorrow), on
        30-minute business-hour slots, never double-booking a unit or the demo agent."""
        today = timezone.localdate()
        tz = timezone.get_current_timezone()
        taken: set[tuple] = set()
        visits = []
        for lead in leads:
            if lead.status != Lead.Status.TOUR_SCHEDULED:
                continue
            mine = rng.random() < 0.3
            for _ in range(10):  # a few attempts to find a free slot
                day = today + timedelta(days=rng.randint(1, 14))
                if day.weekday() == 6:  # closed on Sundays
                    continue
                slot = rng.randint(0, 17)  # 09:00 .. 17:30
                start = datetime.combine(day, time(9), tz) + timedelta(minutes=30 * slot)
                keys = {("unit", lead.unit_id, start)} | ({("agent", start)} if mine else set())
                if keys & taken:
                    continue
                taken |= keys
                visits.append(
                    Visit(
                        lead=lead,
                        unit_id=lead.unit_id,
                        agent=agent if mine else None,
                        starts_at=start,
                        ends_at=start + timedelta(minutes=30),
                        notes=rng.choice(["", "", "Bringing a co-signer.", "Asked about parking."]),
                    )
                )
                break
        return Visit.objects.bulk_create(visits)
