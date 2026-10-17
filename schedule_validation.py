"""Server-side schedule constraints for appointments, events and blocked times.

Only *newly introduced* collisions are rejected to preserve old imported data
that might already contain an overlap. Uses ISO local wall-clock times.
"""
from datetime import datetime, timedelta

IGNORED_STATUSES = {"abgesagt", "cancelled", "storniert", "noshow", "warteliste"}

def instant(day, clock, *, end=False):
    if not isinstance(day, str) or not isinstance(clock, str):
        return None
    try:
        return datetime.strptime(day + " " + clock, "%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return None

def window(start_date, start_time, end_date=None, end_time=None):
    if end_date is None:
        end_date = start_date
    if end_time is None:
        return None
    start = instant(start_date, start_time)
    finish = instant(end_date, end_time)
    if not start or not finish:
        return None
    # A same-day end of 00:00 conventionally means end of the day.
    if end_date == start_date and finish <= start:
        finish += timedelta(days=1)
    if finish <= start:
        return None
    if finish - start > timedelta(days=366):
        return None
    return start, finish

def slots(data):
    for kind, field in (("T", "termine"), ("E", "events")):
        for index, item in enumerate(data.get(field, [])):
            if not isinstance(item, dict):
                continue
            if str(item.get("status", "")).lower() in IGNORED_STATUSES:
                continue
            dates = window(item.get("datum"), item.get("start"), end_time=item.get("ende"))
            if dates:
                identifier = str(item.get("id", "index_" + str(index)))
                yield (kind + ":" + identifier, *dates)
    for index, item in enumerate(data.get("sperrzeiten", [])):
        if not isinstance(item, dict):
            continue
        dates = window(item.get("startDatum"), item.get("startZeit", "00:00"),
                       item.get("endDatum"), item.get("endZeit", "23:59"))
        if dates:
            identifier = str(item.get("id", "index_" + str(index)))
            yield ("S:" + identifier, *dates)

def overlaps(data):
    entries = list(slots(data))
    found = set()
    for i, (first_id, first_start, first_end) in enumerate(entries):
        for second_id, second_start, second_end in entries[i + 1:]:
            if first_id == second_id:
                continue
            if first_start < second_end and second_start < first_end:
                found.add(tuple(sorted((first_id, second_id))))
    return found

def introduced_conflicts(old_data, new_data):
    return overlaps(new_data) - overlaps(old_data)
