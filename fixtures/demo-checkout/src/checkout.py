def checkout_total(items: list[dict], customer: dict) -> float:
    """Calculate a customer's checkout total after their optional discount."""
    subtotal = sum(item["price"] * item.get("quantity", 1) for item in items)
    discount_rate = customer.get("discount")
    return round(subtotal * (1 - discount_rate), 2)

