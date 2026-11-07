"""Snapbet multisport pipeline — collect odds, settle results, train, predict, publish.

Ported from the BetGeniusAI backend (models/multisport_collector.py,
models/multisport_data_collector.py, training/multisport_training_sync.py,
features/multisport_feature_builder.py, training/train_multisport_v3.py,
models/multisport_v3_predictor.py, utils/edge.py) so it can run as scheduled
batch jobs (GitHub Actions or a laptop) against the frontend's Postgres.
"""

__version__ = "0.1.0"
