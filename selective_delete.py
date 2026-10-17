"""Single-category, explicitly selected calendar deletions.

The server never trusts displayed names or localStorage as deletion authority.
Customers may be removed without removing their paid appointments or events;
only references to removed customer IDs are unlinked.
"""
from copy import deepcopy
import re

CATEGORIES = ("termine", "kunden", "events")
ID_PATTERN = re.compile(r"[0-9]{1,24}\Z")

class SelectionError(ValueError):
    pass

def id_value(value):
    if type(value) is int:
        return str(value) if 0 <= value <= 10**24 else None
    if isinstance(value, str) and ID_PATTERN.fullmatch(value):
        return value
    return None

def validate_request(category, ids):
    if category not in CATEGORIES:
        raise SelectionError("Nur Termine, Kunden oder Events auswählbar.")
    if not isinstance(ids, list) or not 1 <= len(ids) <= 200:
        raise SelectionError("Bitte 1 bis 200 Einträge auswählen.")
    if any(id_value(item) is None for item in ids):
        raise SelectionError("Eintrag-ID ungültig.")
    chosen = [id_value(item) for item in ids]
    if len(set(chosen)) != len(chosen):
        raise SelectionError("Eintrag wurde mehrfach ausgewählt.")
    return set(chosen)

def remove_selected(snapshot, category, ids):
    wanted = validate_request(category, ids)
    existing = snapshot[category]
    found = [item for item in existing if isinstance(item, dict) and id_value(item.get("id")) in wanted]
    if len(found) != len(wanted):
        raise SelectionError("Einträge nicht eindeutig gefunden oder mehrfach vorhanden. Bitte neu laden.")
    remaining = [item for item in existing if id_value(item.get("id")) not in wanted]
    new_data = deepcopy(snapshot)
    new_data[category] = remaining
    linked = 0
    if category == "kunden":
        # Never delete historical bookings or payments just because a linked
        # customer profile was removed. Keep names and prices unchanged.
        for item in new_data["termine"]:
            for key in ("kunde_id", "kundeId"):
                if id_value(item.get(key)) in wanted:
                    item.pop(key)
                    linked += 1
        for event in new_data["events"]:
            for guest in event.get("guests", []):
                for key in ("kundeId", "kunde_id"):
                    if id_value(guest.get(key)) in wanted:
                        guest.pop(key)
                        linked += 1
    return new_data, len(found), linked
