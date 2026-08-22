from src.checkout import checkout_total


def test_discounted_customer():
    assert checkout_total([{"price": 100}], {"discount": 0.2}) == 80.0


def test_customer_without_discount_pays_full_price():
    assert checkout_total([{"price": 25, "quantity": 2}], {}) == 50.0

