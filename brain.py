import sys
import json
import math
import os
import nltk

NLTK_DATA_PATH = '/app/nltk_data'
os.makedirs(NLTK_DATA_PATH, exist_ok=True)
nltk.data.path.insert(0, NLTK_DATA_PATH)

try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    nltk.download('vader_lexicon', download_dir=NLTK_DATA_PATH, quiet=False)

from nltk.sentiment.vader import SentimentIntensityAnalyzer
analyzer = SentimentIntensityAnalyzer()

def calculate_entropy(text):
    if not text:
        return 0
    prob = [float(text.count(c)) / len(text) for c in dict.fromkeys(list(text))]
    entropy = -sum([p * math.log(p) / math.log(2.0) for p in prob])
    return entropy

def analyze_logic(text):
    scores = analyzer.polarity_scores(text)
    compound = scores['compound']
    entropy_score = calculate_entropy(text)

    if entropy_score > 4.0:
        label = 'ANOMALOUS_DATA'
        score = 1.0
    elif compound >= 0.05:
        label = 'POSITIVE'
        score = compound
    elif compound <= -0.05:
        label = 'NEGATIVE'
        score = abs(compound)
    else:
        label = 'NEUTRAL'
        score = 0.5

    return {"label": label, "score": score, "entropy": round(entropy_score, 2)}

if __name__ == "__main__":
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            result = analyze_logic(line.strip())
            print(json.dumps(result))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({"label": "ERROR", "score": 0.0, "entropy": 0, "error": str(e)}))
            sys.stdout.flush()
