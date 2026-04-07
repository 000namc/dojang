import csv
import random

random.seed(42)

with open("/workspace/house_prices.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["area", "rooms", "age", "price"])
    for _ in range(50):
        area = round(random.uniform(30, 150), 1)
        rooms = random.randint(1, 5)
        age = random.randint(1, 40)
        price = round(30 * area + 500 * rooms - 10 * age + random.gauss(0, 200), 1)
        w.writerow([area, rooms, age, price])
