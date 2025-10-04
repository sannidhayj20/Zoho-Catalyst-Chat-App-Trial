import pandas as pd

# Data extracted from the provided image for "Conversation" and "IF-general" (English/Conversational)
data = [
    {"Benchmark/Dataset": "ABC-Eval [19]", "Category": "Conversation", "Total Dialogues": 400, "Avg. Turns": 30.3},
    {"Benchmark/Dataset": "MT-Bench [21]", "Category": "IF-general", "Total Dialogues": 80, "Avg. Turns": 2},
    {"Benchmark/Dataset": "MT-Bench++ [24]", "Category": "IF-general", "Total Dialogues": 80, "Avg. Turns": 8},
    {"Benchmark/Dataset": "BotChat [25]", "Category": "Conversation", "Total Dialogues": 547, "Avg. Turns": 16},
    {"Benchmark/Dataset": "MT-Eval [27]", "Category": "IF-general", "Total Dialogues": 168, "Avg. Turns": 6.96},
    {"Benchmark/Dataset": "WebLINX [28]", "Category": "IF-general", "Total Dialogues": 2337, "Avg. Turns": 43},
    {"Benchmark/Dataset": "MT-Bench-101 [30]", "Category": "IF-general", "Total Dialogues": 1388, "Avg. Turns": 3.03},
    {"Benchmark/Dataset": "M2Lingual [32]", "Category": "IF-general", "Total Dialogues": 1140, "Avg. Turns": 2.48},
    {"Benchmark/Dataset": "SysBench [33]", "Category": "IF-general", "Total Dialogues": 500, "Avg. Turns": 5},
    {"Benchmark/Dataset": "FB-Bench [34]", "Category": "IF-general", "Total Dialogues": 591, "Avg. Turns": 2},
    {"Benchmark/Dataset": "Multi-IF [36]", "Category": "IF-general", "Total Dialogues": 909, "Avg. Turns": 3},
]

# Create DataFrame
df = pd.DataFrame(data)

import matplotlib.pyplot as plt

# Scatter plot: Total Dialogues vs Avg. Turns
plt.figure(figsize=(10,6))
plt.scatter(df["Total Dialogues"], df["Avg. Turns"], s=100, c="blue", alpha=0.7)

# Annotate with dataset names
for i, row in df.iterrows():
    plt.text(row["Total Dialogues"]+20, row["Avg. Turns"]+0.1, row["Benchmark/Dataset"].split()[0], fontsize=9)

plt.xlabel("Total Dialogues")
plt.ylabel("Average Turns")
plt.title("English/Conversational Benchmarks: Dialogues vs Turns")
plt.grid(True, linestyle="--", alpha=0.6)
plt.show()
