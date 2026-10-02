import numpy as np
from optimization.service import OptimizationEngine
from core.prediction import predict_from_actual, calculate_desirability

class DesignSpaceEngine:
    @staticmethod
    def calculate_space(
        factors,
        models_data,
        constraints=None,
        resolution=20,
        resolution_3d=20,
        slice_axis_x=None,
        slice_axis_y=None,
        fixed_factors=None,
    ):
        """
        Calculates both:
        1. Full Multidimensional (3D) Design Space feasibility across complete investigated factor bounds.
        2. 2D Cross-Sectional Design Space Slice for visualization with user-selectable axes and fixed factors.
        """
        if not factors:
            return {
                "acceptable_points": 0,
                "unacceptable_points": 0,
                "total_points": 0,
                "plot_data": [],
                "projected_ranges": {},
                "is_entire_range_acceptable": False
            }

        factor_map = {f.code: f for f in factors}
        fixed_factors = dict(fixed_factors or {})
        num_factors = len(factors)

        # ---------------------------------------------------------------------
        # 1. Full Multidimensional (3D) Design Space Calculation
        # ---------------------------------------------------------------------
        if num_factors >= 3:
            f3 = factors[:3]
            grids_3d = [np.linspace(f.low_value, f.high_value, resolution_3d) for f in f3]
            m0, m1, m2 = np.meshgrid(grids_3d[0], grids_3d[1], grids_3d[2], indexing='ij')
            flat0, flat1, flat2 = m0.ravel(), m1.ravel(), m2.ravel()
            total_3d = len(flat0)

            # Center values for any factors beyond the 3rd
            extra_fv = {f.code: (f.low_value + f.high_value) / 2.0 for f in factors[3:]}

            acc_3d = 0
            unacc_3d = 0
            min_acc_3d = {f.code: float('inf') for f in factors}
            max_acc_3d = {f.code: float('-inf') for f in factors}

            for i in range(total_3d):
                fv = {
                    f3[0].code: float(flat0[i]),
                    f3[1].code: float(flat1[i]),
                    f3[2].code: float(flat2[i]),
                    **extra_fv
                }

                is_ok = True
                for md in models_data:
                    pred = predict_from_actual(factors, fv, md["coefs"], md.get("transformation", "NONE"))
                    d = calculate_desirability(
                        y=pred,
                        target_type=md.get("target_type", "MAXIMIZE"),
                        lower_limit=md.get("lower_limit"),
                        upper_limit=md.get("upper_limit"),
                        target=md.get("target"),
                        importance=md.get("importance", 3.0),
                    )
                    if d <= 0.05:
                        is_ok = False
                        break

                if is_ok:
                    acc_3d += 1
                    for f in factors:
                        val = fv[f.code]
                        if val < min_acc_3d[f.code]:
                            min_acc_3d[f.code] = val
                        if val > max_acc_3d[f.code]:
                            max_acc_3d[f.code] = val
                else:
                    unacc_3d += 1

            projected_ranges_3d = {}
            for f in factors:
                if acc_3d > 0 and min_acc_3d[f.code] != float('inf'):
                    min_v = float(min_acc_3d[f.code])
                    max_v = float(max_acc_3d[f.code])
                    projected_ranges_3d[f.code] = {
                        "min": min_v,
                        "max": max_v,
                        "investigated_min": float(f.low_value),
                        "investigated_max": float(f.high_value),
                        "is_full_investigated_range": bool(unacc_3d == 0 and min_v <= f.low_value and max_v >= f.high_value)
                    }
                else:
                    projected_ranges_3d[f.code] = {
                        "min": None,
                        "max": None,
                        "investigated_min": float(f.low_value),
                        "investigated_max": float(f.high_value),
                        "is_full_investigated_range": False
                    }

        else:
            # 1 or 2 factors: full evaluated space is 1D or 2D
            f_eval = factors[:2]
            grids_eval = [np.linspace(f.low_value, f.high_value, resolution) for f in f_eval]
            if len(f_eval) == 1:
                mesh = np.meshgrid(grids_eval[0])
            else:
                mesh = np.meshgrid(grids_eval[0], grids_eval[1])
            flat_mesh = [m.ravel() for m in mesh]
            total_3d = len(flat_mesh[0])
            acc_3d = 0
            unacc_3d = 0
            min_acc_3d = {f.code: float('inf') for f in factors}
            max_acc_3d = {f.code: float('-inf') for f in factors}

            for i in range(total_3d):
                fv = {f_eval[j].code: float(flat_mesh[j][i]) for j in range(len(f_eval))}
                is_ok = True
                for md in models_data:
                    pred = predict_from_actual(factors, fv, md["coefs"], md.get("transformation", "NONE"))
                    d = calculate_desirability(
                        y=pred,
                        target_type=md.get("target_type", "MAXIMIZE"),
                        lower_limit=md.get("lower_limit"),
                        upper_limit=md.get("upper_limit"),
                        target=md.get("target"),
                        importance=md.get("importance", 3.0),
                    )
                    if d <= 0.05:
                        is_ok = False
                        break
                if is_ok:
                    acc_3d += 1
                    for f in factors:
                        val = fv[f.code]
                        if val < min_acc_3d[f.code]:
                            min_acc_3d[f.code] = val
                        if val > max_acc_3d[f.code]:
                            max_acc_3d[f.code] = val
                else:
                    unacc_3d += 1

            projected_ranges_3d = {}
            for f in factors:
                if acc_3d > 0 and min_acc_3d[f.code] != float('inf'):
                    min_v = float(min_acc_3d[f.code])
                    max_v = float(max_acc_3d[f.code])
                    projected_ranges_3d[f.code] = {
                        "min": min_v,
                        "max": max_v,
                        "investigated_min": float(f.low_value),
                        "investigated_max": float(f.high_value),
                        "is_full_investigated_range": bool(unacc_3d == 0 and min_v <= f.low_value and max_v >= f.high_value)
                    }
                else:
                    projected_ranges_3d[f.code] = {
                        "min": None,
                        "max": None,
                        "investigated_min": float(f.low_value),
                        "investigated_max": float(f.high_value),
                        "is_full_investigated_range": False
                    }

        is_entire_range_acceptable = bool(unacc_3d == 0 and acc_3d > 0)
        feasible_3d_pct = round((acc_3d / total_3d) * 100, 2) if total_3d > 0 else 0.0

        # ---------------------------------------------------------------------
        # 2. 2D Cross-Sectional Design Space Slice Calculation
        # ---------------------------------------------------------------------
        # Determine X and Y axes for the slice
        if slice_axis_x and slice_axis_x in factor_map:
            fx = factor_map[slice_axis_x]
        else:
            fx = factors[0]

        if slice_axis_y and slice_axis_y in factor_map and slice_axis_y != fx.code:
            fy = factor_map[slice_axis_y]
        elif len(factors) > 1:
            fy = next(f for f in factors if f.code != fx.code)
        else:
            fy = fx

        # Determine fixed factors for the slice
        resolved_fixed_factors = {}
        fixed_desc_parts = []
        for f in factors:
            if f.code != fx.code and f.code != fy.code:
                if f.code in fixed_factors:
                    val = float(fixed_factors[f.code])
                else:
                    val = (f.low_value + f.high_value) / 2.0
                resolved_fixed_factors[f.code] = val
                fixed_desc_parts.append(f"{f.name} ({f.code}) = {val:.2f}{f.unit or ''}")

        if fixed_desc_parts:
            slice_label = f"2D Slice at Fixed {', '.join(fixed_desc_parts)}"
        else:
            slice_label = f"2D Space ({fx.code} × {fy.code})"

        # Generate 2D slice grid
        grid_x = np.linspace(fx.low_value, fx.high_value, resolution)
        grid_y = np.linspace(fy.low_value, fy.high_value, resolution)
        mx, my = np.meshgrid(grid_x, grid_y, indexing='xy')
        flat_x, flat_y = mx.ravel(), my.ravel()
        total_slice = len(flat_x)

        acc_slice = 0
        unacc_slice = 0
        plot_data_slice = []

        for i in range(total_slice):
            fv = {
                fx.code: float(flat_x[i]),
                fy.code: float(flat_y[i]),
                **resolved_fixed_factors
            }

            is_ok = True
            for md in models_data:
                pred = predict_from_actual(factors, fv, md["coefs"], md.get("transformation", "NONE"))
                d = calculate_desirability(
                    y=pred,
                    target_type=md.get("target_type", "MAXIMIZE"),
                    lower_limit=md.get("lower_limit"),
                    upper_limit=md.get("upper_limit"),
                    target=md.get("target"),
                    importance=md.get("importance", 3.0),
                )
                if d <= 0.05:
                    is_ok = False
                    break

            if is_ok:
                acc_slice += 1
            else:
                unacc_slice += 1

            plot_data_slice.append({"factors": fv, "acceptable": is_ok})

        feasible_slice_pct = round((acc_slice / total_slice) * 100, 2) if total_slice > 0 else 0.0

        return {
            "dimension": num_factors,
            "total_3d_points": total_3d,
            "acceptable_3d_points": acc_3d,
            "unacceptable_3d_points": unacc_3d,
            "feasible_3d_percentage": feasible_3d_pct,
            "is_entire_3d_range_acceptable": is_entire_range_acceptable,
            "projected_ranges_3d": projected_ranges_3d,

            # Backwards-compatible root properties mapped to true 3D multidimensional evaluation
            "acceptable_points": acc_3d,
            "unacceptable_points": unacc_3d,
            "total_points": total_3d,
            "is_entire_range_acceptable": is_entire_range_acceptable,
            "projected_ranges": projected_ranges_3d,

            # Detailed 2D Slice data
            "slice_data": {
                "axis_x": fx.code,
                "axis_y": fy.code,
                "fixed_factors": resolved_fixed_factors,
                "slice_label": slice_label,
                "acceptable_points": acc_slice,
                "unacceptable_points": unacc_slice,
                "total_points": total_slice,
                "feasible_percentage": feasible_slice_pct,
                "plot_data": plot_data_slice
            },
            "plot_data": plot_data_slice
        }

    @staticmethod
    def verify_point_membership(factors, models_data, factor_values, threshold=0.05):
        """
        Evaluates whether a specific factor coordinate (e.g. the optimal setpoint)
        satisfies all design space criteria simultaneously without extrapolation.
        """
        # 1. Boundary check: ensure no extrapolation outside investigated bounds
        for f in factors:
            v = factor_values.get(f.code)
            if v is None:
                return {
                    "is_inside": False,
                    "reason": f"Factor {f.code} missing from setpoints",
                    "cqa_results": {}
                }
            if v < f.low_value - 1e-5 or v > f.high_value + 1e-5:
                return {
                    "is_inside": False,
                    "reason": f"Factor {f.code} value {v} extrapolates outside investigated range [{f.low_value}, {f.high_value}]",
                    "cqa_results": {}
                }

        # 2. CQA satisfaction
        cqa_results = {}
        all_acceptable = True
        for md in models_data:
            pred = predict_from_actual(factors, factor_values, md["coefs"], md.get("transformation", "NONE"))
            d = calculate_desirability(
                y=pred,
                target_type=md.get("target_type", "MAXIMIZE"),
                lower_limit=md.get("lower_limit"),
                upper_limit=md.get("upper_limit"),
                target=md.get("target"),
                importance=md.get("importance", 3.0),
            )
            is_cqa_ok = bool(d > threshold)
            if not is_cqa_ok:
                all_acceptable = False
            cqa_results[md["response_code"]] = {
                "predicted": float(pred),
                "desirability": float(d),
                "acceptable": is_cqa_ok
            }

        return {
            "is_inside": all_acceptable,
            "cqa_results": cqa_results
        }
