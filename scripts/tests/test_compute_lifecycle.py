#!/usr/bin/env python3
"""Unit tests for skills/compute lifecycle. Run: python3 scripts/tests/test_compute_lifecycle.py"""
import os
import sys
import unittest

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "skills", "compute"))
import lifecycle as L  # noqa: E402

S = L.ResourceState


class TestTransitions(unittest.TestCase):
    def test_valid_edges(self):
        self.assertEqual(L.transition(S.DISCOVERED, S.AVAILABLE), S.AVAILABLE)
        self.assertEqual(L.transition(S.AVAILABLE, S.PROVISIONING), S.PROVISIONING)
        self.assertEqual(L.transition(S.PROVISIONING, S.RUNNING), S.RUNNING)
        self.assertEqual(L.transition(S.RUNNING, S.UNAVAILABLE), S.UNAVAILABLE)
        self.assertEqual(L.transition(S.UNAVAILABLE, S.AVAILABLE), S.AVAILABLE)  # recovery
        self.assertEqual(L.transition(S.TERMINATING, S.TERMINATED), S.TERMINATED)

    def test_discovery_cannot_jump_to_running(self):
        with self.assertRaises(L.InvalidTransition):
            L.transition(S.DISCOVERED, S.RUNNING)
        with self.assertRaises(L.InvalidTransition):
            L.transition(S.AVAILABLE, S.RUNNING)

    def test_terminated_is_terminal(self):
        for target in S:
            with self.assertRaises(L.InvalidTransition):
                L.transition(S.TERMINATED, target)

    def test_self_transition_rejected(self):
        with self.assertRaises(L.InvalidTransition):
            L.transition(S.DISCOVERED, S.DISCOVERED)

    def test_can_transition(self):
        self.assertTrue(L.can_transition(S.PROVISIONING, S.FAILED))
        self.assertFalse(L.can_transition(S.DISCOVERED, S.TERMINATED))

    def test_type_guard(self):
        with self.assertRaises(ValueError):
            L.transition("discovered", S.AVAILABLE)

    def test_sets(self):
        self.assertIn(S.DISCOVERED, L.DISCOVERY_STATES)
        self.assertIn(S.AVAILABLE, L.DISCOVERY_STATES)
        self.assertNotIn(S.RUNNING, L.DISCOVERY_STATES)
        self.assertEqual(L.TERMINAL_STATES, frozenset({S.TERMINATED}))
        self.assertEqual(L.allowed_targets(S.TERMINATED), frozenset())


if __name__ == "__main__":
    unittest.main()
