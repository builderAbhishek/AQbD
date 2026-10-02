import numpy as np
from scipy.optimize import differential_evolution
from typing import List, Dict, Any, Optional

from core.prediction import (
    actual_to_coded,
    predict_from_coded,
    predict_from_actual,
    calculate_desirability as core_calculate_desirability,
    calculate_overall_desirability as core_calculate_overall_desirability,
)

class OptimizationEngine:
    @staticmethod
    def _predict(factors, factor_values, model_coefs, model_type=None, transformation="NONE"):
        """
        Shared prediction function: transforms actual engineering units to coded units [-1, +1]
        and evaluates the polynomial model.
        """
        return predict_from_actual(factors, factor_values, model_coefs, transformation)

    @staticmethod
    def calculate_desirability(y, target_type, lower=None, upper=None, *args, **kwargs):
        """
        Derringer-Suich individual desirability function.
        Backwards-compatible wrapper around core.prediction.calculate_desirability.
        """
        importance = kwargs.get("importance")
        target = kwargs.get("target")
        data_min = kwargs.get("data_min")
        data_max = kwargs.get("data_max")

        if len(args) >= 1 and importance is None:
            importance = args[0]
        if len(args) >= 2 and target is None:
            target = args[1]

        return core_calculate_desirability(
            y=float(y),
            target_type=target_type,
            lower_limit=float(lower) if lower is not None else None,
            upper_limit=float(upper) if upper is not None else None,
            target=float(target) if target is not None else None,
            data_min=float(data_min) if data_min is not None else None,
            data_max=float(data_max) if data_max is not None else None,
            importance=float(importance) if importance is not None else 3.0,
        )

    @staticmethod
    def optimize(factors, models_data, settings=None):
        settings = settings or {}
        bounds = [(float(f.low_value), float(f.high_value)) for f in factors]
        factor_codes = [f.code for f in factors]

        def objective(x):
            fv = {code: val for code, val in zip(factor_codes, x)}
            individual_des = {}
            importances = {}
            for md in models_data:
                pred = predict_from_actual(factors, fv, md["coefs"], md.get("transformation", "NONE"))
                d = core_calculate_desirability(
                    y=pred,
                    target_type=md.get("target_type", "MAXIMIZE"),
                    lower_limit=md.get("lower_limit"),
                    upper_limit=md.get("upper_limit"),
                    target=md.get("target"),
                    data_min=md.get("data_min"),
                    data_max=md.get("data_max"),
                    importance=md.get("importance", 3.0),
                )
                individual_des[md["response_code"]] = d
                importances[md["response_code"]] = md.get("importance", 3.0)

            D = core_calculate_overall_desirability(individual_des, importances)
            return -D  # Minimizing negative desirability

        res = differential_evolution(
            objective,
            bounds,
            strategy="best1bin",
            maxiter=200,
            popsize=25,
            tol=1e-6,
            mutation=(0.5, 1.0),
            recombination=0.7,
            seed=42
        )

        best_x = res.x
        fv = {code: float(val) for code, val in zip(factor_codes, best_x)}

        responses = {}
        desirabilities = {}
        importances = {}
        for md in models_data:
            rcode = md["response_code"]
            pred = predict_from_actual(factors, fv, md["coefs"], md.get("transformation", "NONE"))
            d = core_calculate_desirability(
                y=pred,
                target_type=md.get("target_type", "MAXIMIZE"),
                lower_limit=md.get("lower_limit"),
                upper_limit=md.get("upper_limit"),
                target=md.get("target"),
                data_min=md.get("data_min"),
                data_max=md.get("data_max"),
                importance=md.get("importance", 3.0),
            )
            responses[rcode] = float(pred)
            desirabilities[rcode] = float(d)
            importances[rcode] = float(md.get("importance", 3.0))

        overall_d = core_calculate_overall_desirability(desirabilities, importances)

        # Pre/Post Feasibility Check
        is_feasible = bool(overall_d > 0.0)
        violating_responses = []

        for md in models_data:
            rcode = md["response_code"]
            rname = md.get("response_name", rcode)
            d = desirabilities.get(rcode, 0.0)
            pred = responses.get(rcode, 0.0)
            ttype = md.get("target_type", "MAXIMIZE")
            llim = md.get("lower_limit")
            ulim = md.get("upper_limit")
            targ = md.get("target")

            if d <= 0.0:
                spec_str = ""
                if ttype == "MAXIMIZE" and llim is not None:
                    spec_str = f"Required ≥ {llim}, but predicted {pred:.3f}"
                elif ttype == "MINIMIZE" and ulim is not None:
                    spec_str = f"Required ≤ {ulim}, but predicted {pred:.3f}"
                elif ttype == "TARGET" and targ is not None:
                    spec_str = f"Target {targ}, but predicted {pred:.3f} (outside acceptable limits)"
                elif ttype == "RANGE" and llim is not None and ulim is not None:
                    spec_str = f"Required [{llim} – {ulim}], but predicted {pred:.3f}"
                else:
                    spec_str = f"Predicted {pred:.3f} violates {ttype} criterion"

                violating_responses.append({
                    "response_code": rcode,
                    "response_name": rname,
                    "target_type": ttype,
                    "predicted": pred,
                    "issue": spec_str
                })

        if is_feasible:
            feasibility_status = "FEASIBLE"
            feasibility_message = "Optimal acceptable operating point found within investigated factor boundaries."
        else:
            feasibility_status = "INFEASIBLE"
            feasibility_message = "No feasible operating point exists within the investigated factor region for the current models and acceptance criteria."

        candidate = {
            "factors": fv,
            "responses": responses,
            "desirabilities": desirabilities,
            "overall_desirability": float(overall_d),
            "is_feasible": is_feasible,
            "feasibility_status": feasibility_status,
            "feasibility_message": feasibility_message,
            "violating_responses": violating_responses,
        }

        return [candidate]
