"""
Train an AAC next-word prediction model and export to TensorFlow.js format.

Usage:
    pip install -r requirements-train.txt
    python train_aac_model.py [--epochs 10] [--vocab-size 1000] [--seq-len 4]

Outputs to assets/tf_model/word_prediction_tfjs/:
    model.json            - TFJS model architecture + weight manifest
    group1-shard1of1.bin  - Model weights
    tokenizer.json        - Word-to-index mapping (used by the app)
"""

import argparse
import json
import os

import numpy as np
import tensorflow as tf
from tensorflow import keras
from datasets import load_dataset

SEED = 42
np.random.seed(SEED)
tf.random.set_seed(SEED)

OUTPUT_DIR = os.path.join("assets", "tf_model", "word_prediction_tfjs")


def parse_args():
    parser = argparse.ArgumentParser(description="Train AAC word prediction model")
    parser.add_argument("--epochs", type=int, default=10, help="Training epochs")
    parser.add_argument("--vocab-size", type=int, default=1000, help="Max vocabulary size")
    parser.add_argument("--seq-len", type=int, default=4, help="Input sequence length")
    parser.add_argument("--batch-size", type=int, default=64, help="Training batch size")
    parser.add_argument("--lstm-units", type=int, default=128, help="LSTM hidden units")
    parser.add_argument("--embedding-dim", type=int, default=64, help="Embedding dimension")
    return parser.parse_args()


def load_texts():
    """Load English AAC utterances from Hugging Face dataset."""
    dataset = load_dataset("willwade/AACConversations", split="train")
    texts = [
        ex["fully_corrected"] or ex["minimally_corrected"] or ex["utterance"]
        for ex in dataset
        if ex["language_code"].startswith("en") and ex.get("fully_corrected")
    ]
    texts = [t.strip() for t in texts if t and len(t.strip().split()) > 2]
    print(f"Loaded {len(texts)} English utterances (>2 words)")
    return texts


def build_sequences(texts, tokenizer, seq_len):
    """Create input/target pairs using a sliding window."""
    sequences = tokenizer.texts_to_sequences(texts)
    X, y = [], []
    for seq in sequences:
        for i in range(len(seq) - seq_len):
            X.append(seq[i : i + seq_len])
            y.append(seq[i + seq_len])
    return np.array(X), np.array(y)


def build_model(vocab_size, seq_len, embedding_dim, lstm_units):
    """Build a 2-layer LSTM model matching the app's expected architecture."""
    model = keras.Sequential([
        keras.layers.Embedding(vocab_size, embedding_dim, input_length=seq_len),
        keras.layers.LSTM(lstm_units, return_sequences=True),
        keras.layers.LSTM(lstm_units, return_sequences=False),
        keras.layers.Dropout(0.3),
        keras.layers.Dense(vocab_size, activation="softmax"),
    ])
    model.compile(
        loss="sparse_categorical_crossentropy",
        optimizer="adam",
        metrics=["accuracy"],
    )
    model.summary()
    return model


def export_tfjs(model, output_dir):
    """Convert Keras model to TensorFlow.js Layers format."""
    try:
        import tensorflowjs as tfjs
    except ImportError:
        raise SystemExit(
            "tensorflowjs is required for export. Install with:\n"
            "  pip install tensorflowjs"
        )
    os.makedirs(output_dir, exist_ok=True)
    tfjs.converters.save_keras_model(model, output_dir)
    print(f"TFJS model exported to {output_dir}/")


def save_tokenizer(tokenizer, output_dir):
    """Save tokenizer word index as JSON for the app to load."""
    path = os.path.join(output_dir, "tokenizer.json")
    with open(path, "w") as f:
        json.dump(tokenizer.word_index, f)
    print(f"Tokenizer saved to {path} ({len(tokenizer.word_index)} words)")


def main():
    args = parse_args()

    texts = load_texts()

    tokenizer = keras.preprocessing.text.Tokenizer(
        num_words=args.vocab_size, oov_token="<UNK>"
    )
    tokenizer.fit_on_texts(texts)

    X, y = build_sequences(texts, tokenizer, args.seq_len)
    print(f"Training samples: {len(X)}")

    vocab_size = min(args.vocab_size, len(tokenizer.word_index) + 1)
    model = build_model(vocab_size, args.seq_len, args.embedding_dim, args.lstm_units)

    model.fit(
        X, y,
        epochs=args.epochs,
        batch_size=args.batch_size,
        validation_split=0.1,
        callbacks=[
            keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),
        ],
    )

    # Evaluate
    val_loss, val_acc = model.evaluate(X, y, verbose=0)
    print(f"Final — loss: {val_loss:.4f}, accuracy: {val_acc:.4f}")

    # Export to TFJS format (what the app loads)
    export_tfjs(model, OUTPUT_DIR)
    save_tokenizer(tokenizer, OUTPUT_DIR)

    # Also save Keras format for future fine-tuning
    h5_path = os.path.join("assets", "tf_model", "word_pred_model.h5")
    model.save(h5_path)
    print(f"Keras model saved to {h5_path}")


if __name__ == "__main__":
    main()
