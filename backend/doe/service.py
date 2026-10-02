import numpy as np
import pyDOE3 as doe
import random
from datetime import datetime

class DOEEngine:
    @staticmethod
    def generate_full_factorial(factors, center_points=0):
        # 2-level full factorial
        k = len(factors)
        matrix = doe.ff2n(k)
        return DOEEngine._process_matrix(matrix, factors, center_points)

    @staticmethod
    def generate_general_factorial(factors):
        levels = [f.levels if f.levels and f.levels > 0 else 2 for f in factors]
        matrix = doe.fullfact(levels)
        # fullfact returns indices (0, 1, 2). Convert to coded ranges typically [-1, 1]
        coded_matrix = []
        for row in matrix:
            coded_row = []
            for i, val in enumerate(row):
                if levels[i] == 1:
                    coded_row.append(0.0)
                else:
                    coded_row.append(2.0 * val / (levels[i] - 1) - 1.0)
            coded_matrix.append(coded_row)
        return DOEEngine._process_matrix(np.array(coded_matrix), factors, 0)

    @staticmethod
    def generate_ccd(factors, center_points=1, alpha='o', face='ccf'):
        k = len(factors)
        # pyDOE3 ccd signature: ccd(n, center=(1,1), alpha='o', face='c')
        # We'll use defaults based on face type
        matrix = doe.ccdesign(k, center=(center_points, 0), alpha=alpha, face=face)
        return DOEEngine._process_matrix(matrix, factors, 0) # Center points handled by pyDOE3

    @staticmethod
    def generate_bbd(factors, center_points=None):
        k = len(factors)
        if center_points is not None:
            matrix = doe.bbdesign(k, center=center_points)
        else:
            matrix = doe.bbdesign(k)
        return DOEEngine._process_matrix(matrix, factors, 0) # Center points handled by pyDOE3

    @staticmethod
    def _process_matrix(matrix, factors, center_points):
        # Add explicit center points if needed
        if center_points > 0:
            centers = np.zeros((center_points, len(factors)))
            matrix = np.vstack([matrix, centers])

        coded_matrix = matrix.tolist()
        actual_matrix = []
        
        for row in coded_matrix:
            actual_row = []
            for i, val in enumerate(row):
                f = factors[i]
                if f.type == "CONTINUOUS":
                    center = f.center_value if f.center_value is not None else (f.high_value + f.low_value) / 2
                    scale = (f.high_value - f.low_value) / 2
                    actual_val = center + val * scale
                    actual_row.append(actual_val)
                else:
                    # Categorical logic - map directly or keep coded based on specific needs
                    actual_row.append(val)
            actual_matrix.append(actual_row)
            
        return coded_matrix, actual_matrix

    @staticmethod
    def randomize_design(num_runs, seed=None):
        if seed is None:
            seed = random.randint(1, 999999)
        random.seed(seed)
        std_order = list(range(1, num_runs + 1))
        run_order = std_order.copy()
        random.shuffle(run_order)
        return std_order, run_order, seed
