import tensorflow as tf
from datasets import load_dataset
import numpy as np
from tensorflow import keras
import os

# Load only English (en-GB, en-US, etc.) and minimally corrected utterances
dataset = load_dataset("willwade/AACConversations", split="train")
texts = [
    ex["fully_corrected"] or ex["minimally_corrected"] or ex["utterance"]
    for ex in dataset
    if ex["language_code"].startswith("en") and ex.get("fully_corrected")
]

# Remove empty and very short sentences
texts = [t.strip() for t in texts if t and len(t.strip().split()) > 2]

# Tokenize
tokenizer = keras.preprocessing.text.Tokenizer(num_words=1000, oov_token="<UNK>")
tokenizer.fit_on_texts(texts)
sequences = tokenizer.texts_to_sequences(texts)
SEQ_LEN = 4
X, y = [], []
for seq in sequences:
    for i in range(len(seq) - SEQ_LEN):
        X.append(seq[i:i+SEQ_LEN])
        y.append(seq[i+SEQ_LEN])
X = np.array(X)
y = np.array(y)

vocab_size = min(1000, len(tokenizer.word_index) + 1)
model = keras.Sequential([
    keras.layers.Embedding(vocab_size, 64, input_length=SEQ_LEN),
    keras.layers.LSTM(64),
    keras.layers.Dense(vocab_size, activation='softmax')
])
model.compile(loss="sparse_categorical_crossentropy", optimizer="adam", metrics=["accuracy"])
model.fit(X, y, epochs=5, batch_size=64, validation_split=0.1)

os.makedirs("assets/tf_model", exist_ok=True)
model.save("assets/tf_model/word_pred_model.h5")

# Save tokenizer word index for your app (for utils/vocab.js)
import json
with open("assets/tf_model/vocab.json", "w") as f:
    json.dump(tokenizer.word_index, f)
