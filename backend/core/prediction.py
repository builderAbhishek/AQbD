import math
import re
from typing import Dict, List, Any, Optional

def actual_to_coded(factors: List[Any], actual_vals: Dict[str, float]) -> Dict[str, float]:
    """
    Transforms actual engineering factor values into coded coordinates [-1, +1].
    Formula: coded = (actual - center) / ((high - low) / 2.0)
    """
    coded = {}
    for f in factors:
        code = getattr(f, "code", None) or (f.get("code") if isinstance(f, dict) else None)
        low = float(getattr(f, "low_value", None) if hasattr(f, "low_value") else f.get("low_value"))
        high = float(getattr(f, "high_value", None) if hasattr(f, "high_value") else f.get("high_value"))
        center = (low + high) / 2.0
        half_range = (high - low) / 2.0
        actual = float(actual_vals.get(code, center))
        coded[code] = (actual - center) / half_range if half_range > 0 else 0.0
    return coded

def predict_from_coded(coded_vals: Dict[str, float], coefs: List[Dict[str, Any]], transformation: str = "NONE") -> float:
    """
    Evaluates regression model polynomial in coded space [-1, +1] and inverts transformation.
    """
    y = 0.0
    for c in coefs:
        term = c["term"]
        coef = float(c["coef"])
        if term == "Intercept":
            y += coef
        elif term.startswith("np.power("):
            m = re.match(r"np\.power\((.+),\s*2\)", term)
            if m and m.group(1) in coded_vals:
                y += coef * (coded_vals[m.group(1)] ** 2)
        elif ":" in term:
            parts = term.split(":")
            val = 1.0
            for p in parts:
                val *= coded_vals.get(p, 0.0)
            y += coef * val
        elif term in coded_vals:
            y += coef * coded_vals[term]

    # Invert transformation
    trans = (transformation or "NONE").upper()
    if trans == "LOG":
        y = 10.0 ** y
    elif trans == "SQRT":
        y = y ** 2
    elif trans == "INVERSE":
        y = (1.0 / y) if y != 0 else 0.0

    return float(y)

def predict_from_actual(factors: List[Any], actual_vals: Dict[str, float], coefs: List[Dict[str, Any]], transformation: str = "NONE") -> float:
    """
    Predict response from actual engineering factor values using coded model transformation.
    """
    coded = actual_to_coded(factors, actual_vals)
    return predict_from_coded(coded, coefs, transformation)

def calculate_desirability(
    y: float,
    target_type: str,
    lower_limit: Optional[float] = None,
    upper_limit: Optional[float] = None,
    target: Optional[float] = None,
    data_min: Optional[float] = None,
    data_max: Optional[float] = None,
    importance: float = 3.0
) -> float:
    """
    Derringer-Suich individual desirability function d_i in [0, 1].
    Strictly adheres to quality limits:
    - MAXIMIZE: y < lower_limit -> 0.0. Above lower_limit -> increases toward 1.0.
    - MINIMIZE: y > upper_limit -> 0.0. Below upper_limit -> increases toward 1.0.
    - TARGET: at target -> 1.0. Outside tolerance interval -> 0.0.
    - RANGE: inside [lower, upper] -> 1.0. Outside -> 0.0.
    NEVER returns 0.5 as fallback!
    """
    tt = (target_type or "").upper()
    weight = max(0.1, float(importance) / 3.0)

    if tt == "MAXIMIZE":
        # Acceptable minimum threshold: L
        L = lower_limit
        if L is not None and y < L:
            return 0.0
        
        # Upper desired threshold: T
        T = None
        if upper_limit is not None and (L is None or upper_limit > L):
            T = upper_limit
        elif target is not None and (L is None or target > L):
            T = target
        elif data_max is not None and (L is None or data_max > L):
            T = data_max

        if L is not None:
            if T is not None and T > L:
                if y >= T:
                    return 1.0
                return float(max(0.0, min(1.0, ((y - L) / (T - L)) ** weight)))
            else:
                # Only lower limit specified, y >= L
                return 1.0
        else:
            # No lower limit specified at all: use data range if available
            if data_min is not None and data_max is not None and data_max > data_min:
                if y <= data_min:
                    return 0.0
                if y >= data_max:
                    return 1.0
                return float(max(0.0, min(1.0, ((y - data_min) / (data_max - data_min)) ** weight)))
            return 1.0

    elif tt == "MINIMIZE":
        # Acceptable maximum threshold: U
        U = upper_limit
        if U is not None and y > U:
            return 0.0

        # Lower desired threshold: T
        T = None
        if lower_limit is not None and (U is None or lower_limit < U):
            T = lower_limit
        elif target is not None and (U is None or target < U):
            T = target
        elif data_min is not None and (U is None or data_min < U):
            T = data_min

        if U is not None:
            if T is not None and U > T:
                if y <= T:
                    return 1.0
                return float(max(0.0, min(1.0, ((U - y) / (U - T)) ** weight)))
            else:
                # Only upper limit specified, y <= U
                return 1.0
        else:
            # No upper limit specified at all: use data range if available
            if data_min is not None and data_max is not None and data_max > data_min:
                if y >= data_max:
                    return 0.0
                if y <= data_min:
                    return 1.0
                return float(max(0.0, min(1.0, ((data_max - y) / (data_max - data_min)) ** weight)))
            return 1.0

    elif tt == "TARGET":
        T = target
        if T is None and lower_limit is not None and upper_limit is not None:
            T = (lower_limit + upper_limit) / 2.0
        
        if T is None:
            # Target completely undefined
            return 0.0

        L = lower_limit
        U = upper_limit
        if L is None:
            tol = abs(T) * 0.2 if abs(T) > 1e-6 else 1.0
            L = T - tol
        if U is None:
            tol = abs(T) * 0.2 if abs(T) > 1e-6 else 1.0
            U = T + tol

        if y < L or y > U:
            return 0.0
        if L <= y <= T:
            if abs(T - L) < 1e-9:
                return 1.0
            return float(max(0.0, min(1.0, ((y - L) / (T - L)) ** weight)))
        else:
            if abs(U - T) < 1e-9:
                return 1.0
            return float(max(0.0, min(1.0, ((U - y) / (U - T)) ** weight)))

    elif tt == "RANGE":
        if lower_limit is not None and upper_limit is not None:
            if lower_limit <= y <= upper_limit:
                return 1.0
            return 0.0
        elif lower_limit is not None:
            return 1.0 if y >= lower_limit else 0.0
        elif upper_limit is not None:
            return 1.0 if y <= upper_limit else 0.0
        return 0.0

    return 0.0

def calculate_overall_desirability(individual_desirabilities: Dict[str, float], importances: Dict[str, float]) -> float:
    """
    Geometric mean Derringer-Suich formulation:
    D = (prod(d_i^w_i))^(1 / sum(w_i))
    If any d_i == 0, then D == 0.0.
    """
    if not individual_desirabilities:
        return 0.0
    
    # If any response desirability is 0, overall desirability is strictly 0.0
    for code, d in individual_desirabilities.items():
        if d <= 0.0:
            return 0.0

    total_w = sum(importances.get(code, 3.0) for code in individual_desirabilities)
    if total_w <= 0:
        return 0.0

    prod = 1.0
    for code, d in individual_desirabilities.items():
        w = importances.get(code, 3.0)
        prod *= (d ** (w / total_w))

    return float(max(0.0, min(1.0, prod)))
