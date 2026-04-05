#!/usr/bin/env python3
"""
EquiLearn Data Processing Script
Transforms raw CSV/XLS datasets into a compact JSON for web visualizations.
"""

import csv
import json
import os
import re
from collections import defaultdict

DATA_DIR = "data"
OUTPUT_DIR = "site"


def parse_number(val):
    """Parse French-formatted numbers: spaces as thousands separator, comma as decimal."""
    if val is None or val == '' or val == '<5':
        return None
    val = str(val).strip()
    val = val.replace('\xa0', '').replace(' ', '').replace(',', '.')
    try:
        return float(val)
    except ValueError:
        return None


def parse_int(val):
    """Parse as integer, return None if not possible."""
    n = parse_number(val)
    if n is None:
        return None
    return int(n)


def read_csv_semicolon(filepath, encoding='utf-8-sig'):
    """Read a semicolon-delimited CSV file and return list of dicts.
    Normalizes column names to use standard apostrophes.
    """
    rows = []
    with open(filepath, 'r', encoding=encoding) as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            # Normalize keys: replace curly quotes with straight ones
            normalized = {}
            for k, v in row.items():
                nk = k.replace('\u2019', "'").replace('\u2018', "'")
                normalized[nk] = v
            rows.append(normalized)
    return rows


# =============================================================================
# CHART 4: Girls & Boys in Public CPGEs Over Time
# Dataset: effectifs_CPGE.csv
# =============================================================================
def process_cpge_effectifs():
    """
    Produces time series of girls vs boys in public CPGEs (Scientific track).
    Also produces breakdown by filiere and year.
    """
    filepath = os.path.join(DATA_DIR, "effectifs_CPGE.csv")
    rows = read_csv_semicolon(filepath)

    # Filter: Education nationale only (main ministry), group by year and filiere
    result_by_year_filiere = defaultdict(lambda: {
        'boys_public': 0, 'girls_public': 0, 'boys_private': 0, 'girls_private': 0
    })

    for row in rows:
        year = row.get('Rentrée Scolaire', '').strip()
        ministry = row.get('Ministère', '').strip()
        filiere = row.get('Filière', '').strip()
        annee_etude = row.get('Année', '').strip()

        # Normalize filiere names (some have "Filière" prefix in later years)
        filiere = filiere.replace('Filière ', '').replace('scientifique', 'Scientifique')
        filiere = filiere.replace('économique et commerciale', 'Economique et commerciale')
        filiere = filiere.replace('littéraire', 'Littéraire')

        if not year or not filiere:
            continue

        key = (year, filiere)
        bp = parse_int(row.get('Nombre de garçons dans le public'))
        gp = parse_int(row.get('Nombre de filles dans le public'))
        bpr = parse_int(row.get('Nombre de garçons dans le privé'))
        gpr = parse_int(row.get('Nombre de filles dans le privé'))

        if bp: result_by_year_filiere[key]['boys_public'] += bp
        if gp: result_by_year_filiere[key]['girls_public'] += gp
        if bpr: result_by_year_filiere[key]['boys_private'] += bpr
        if gpr: result_by_year_filiere[key]['girls_private'] += gpr

    # Build time series for Scientific track
    scientific_timeline = []
    all_filieres_timeline = []

    for (year, filiere), counts in sorted(result_by_year_filiere.items()):
        entry = {
            'year': int(year),
            'filiere': filiere,
            'girls_public': counts['girls_public'],
            'boys_public': counts['boys_public'],
            'girls_private': counts['girls_private'],
            'boys_private': counts['boys_private'],
            'total_girls': counts['girls_public'] + counts['girls_private'],
            'total_boys': counts['boys_public'] + counts['boys_private'],
        }
        all_filieres_timeline.append(entry)
        if 'Scientifique' in filiere or 'scientifique' in filiere:
            scientific_timeline.append(entry)

    # Also compute % girls by filiere per year
    gender_ratio_by_filiere = []
    for entry in all_filieres_timeline:
        total = entry['total_girls'] + entry['total_boys']
        if total > 0:
            gender_ratio_by_filiere.append({
                'year': entry['year'],
                'filiere': entry['filiere'],
                'pct_girls': round(100 * entry['total_girls'] / total, 1),
                'total': total
            })

    return {
        'scientific_timeline': sorted(scientific_timeline, key=lambda x: x['year']),
        'all_filieres_timeline': sorted(all_filieres_timeline, key=lambda x: (x['year'], x['filiere'])),
        'gender_ratio_by_filiere': sorted(gender_ratio_by_filiere, key=lambda x: (x['year'], x['filiere']))
    }


# =============================================================================
# CHARTS 1 & 2: Gender in Science Specializations (Terminale)
# Dataset: effectifs_specialites_terminale.csv
# =============================================================================
def process_specializations():
    """
    From the terminale specialization data, extract boy/girl counts for each
    scientific specialization combination.
    """
    filepath = os.path.join(DATA_DIR, "effectifs_specialites_terminale.csv")

    # Read header to discover specialization columns
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        headers = next(reader)

    # Find columns that match pattern "CODE - SPECIALIZATION - filles/garcons"
    # Scientific specializations codes known from the MVP:
    # 0613 = MATHEMATIQUES
    # 0629 = ? (likely SVT - Sciences de la Vie et de la Terre / Biology)
    # 0001 = MATHEMATIQUES/PHYSIQUE-CHIMIE
    # 0003 = PHYSIQUE-CHIMIE/SVT
    # 0004 = MATHEMATIQUES/SVT
    # 0005 = MATHEMATIQUES/SES (Sciences Economiques et Sociales)
    # 0014 = MATHEMATIQUES/SCIENCES DE L'INGENIEUR
    # 4806 = SCIENCES DE L'INGENIEUR/PHYSIQUE-CHIMIE (Engineering Sciences & Physics)

    # Find all pairs of filles/garcons columns
    spec_columns = {}  # name -> {'filles': col_idx, 'garcons': col_idx}
    for i, h in enumerate(headers):
        h_clean = h.strip()
        if h_clean.endswith(' - filles') or h_clean.endswith(' - garcons'):
            # Extract the specialization name (everything before " - filles/garcons")
            if h_clean.endswith(' - filles'):
                spec_name = h_clean[:-9].strip()
                if spec_name not in spec_columns:
                    spec_columns[spec_name] = {}
                spec_columns[spec_name]['filles_idx'] = i
                spec_columns[spec_name]['filles_col'] = h
            elif h_clean.endswith(' - garcons'):
                spec_name = h_clean[:-10].strip()
                if spec_name not in spec_columns:
                    spec_columns[spec_name] = {}
                spec_columns[spec_name]['garcons_idx'] = i
                spec_columns[spec_name]['garcons_col'] = h

    # Identify scientific specializations
    # Keywords: MATHEMATIQUES, PHYSIQUE, CHIMIE, SVT, SCIENCES DE L'INGENIEUR, NUMERIQUE, NSI
    scientific_keywords = [
        'MATHEMATIQUES', 'PHYSIQUE', 'CHIMIE', 'SVT', 'SCIENCES DE LA VIE',
        'INGENIEUR', 'INGÉNIEUR', 'NUMERIQUE', 'NUMÉRIQUE', 'NSI', 'INFORMATIQUE'
    ]

    scientific_specs = {}
    for spec_name, cols in spec_columns.items():
        upper_name = spec_name.upper()
        if any(kw in upper_name for kw in scientific_keywords):
            if 'filles_idx' in cols and 'garcons_idx' in cols:
                scientific_specs[spec_name] = cols

    print(f"  Found {len(spec_columns)} total specialization pairs")
    print(f"  Found {len(scientific_specs)} scientific specialization pairs")
    for name in sorted(scientific_specs.keys()):
        print(f"    - {name}")

    # Now read all rows and aggregate for the most recent year
    rows = read_csv_semicolon(filepath)

    # Group by year to find latest
    years = set()
    for row in rows:
        y = row.get('Rentrée scolaire', '').strip()
        if y:
            years.add(y)
    latest_year = max(years) if years else None
    print(f"  Available years: {sorted(years)}")
    print(f"  Using latest year: {latest_year}")

    # Aggregate by specialization (national level) for latest year
    national_spec_totals = defaultdict(lambda: {'filles': 0, 'garcons': 0})

    # Also aggregate by region for the map
    regional_spec_totals = defaultdict(lambda: {'filles': 0, 'garcons': 0})

    for row in rows:
        y = row.get('Rentrée scolaire', '').strip()
        if y != latest_year:
            continue

        region = row.get('Région académique', '').strip()

        for spec_name, cols in scientific_specs.items():
            f_col = cols.get('filles_col', '')
            g_col = cols.get('garcons_col', '')
            filles = parse_int(row.get(f_col))
            garcons = parse_int(row.get(g_col))

            if filles:
                national_spec_totals[spec_name]['filles'] += filles
            if garcons:
                national_spec_totals[spec_name]['garcons'] += garcons

            if region:
                if filles:
                    regional_spec_totals[region]['filles'] += filles
                if garcons:
                    regional_spec_totals[region]['garcons'] += garcons

    # Format results
    # Chart 2: Per-specialization breakdown
    spec_breakdown = []
    for spec_name in sorted(national_spec_totals.keys(),
                            key=lambda x: national_spec_totals[x]['filles'] + national_spec_totals[x]['garcons'],
                            reverse=True):
        totals = national_spec_totals[spec_name]
        total = totals['filles'] + totals['garcons']
        if total < 100:  # Skip very small combinations
            continue
        # Clean up the name for display
        display_name = spec_name
        # Remove numeric prefix if present
        match = re.match(r'^(\d+)\s*[-_]?\s*(.+)$', spec_name)
        if match:
            display_name = match.group(2).strip()
        # Shorten common names
        display_name = display_name.replace('MATHEMATIQUES', 'Maths')
        display_name = display_name.replace('PHYSIQUE-CHIMIE', 'Physics-Chemistry')
        display_name = display_name.replace('PHYSIQUE CHIMIE', 'Physics-Chemistry')
        display_name = display_name.replace('SCIENCES DE LA VIE ET DE LA TERRE', 'Biology & Earth Sci.')
        display_name = display_name.replace('SCIENCES DE L\'INGENIEUR', 'Engineering Sci.')
        display_name = display_name.replace("SCIENCES DE L'INGÉNIEUR", 'Engineering Sci.')
        display_name = display_name.replace('SCIENCES INGE. ET PHY', 'Engineering & Physics')
        display_name = display_name.replace('SCIENCES NUMERIQUES', 'Digital Sci.')
        display_name = display_name.replace('NUMERIQUE ET SCIENCES INFORMATIQUES', 'CS & Digital')
        display_name = display_name.replace('NUMÉRIQUE ET SCIENCES INFORMATIQUES', 'CS & Digital')

        spec_breakdown.append({
            'name': display_name,
            'code': spec_name,
            'girls': totals['filles'],
            'boys': totals['garcons'],
            'total': total,
            'pct_girls': round(100 * totals['filles'] / total, 1) if total > 0 else 0
        })

    # Chart 1: Regional breakdown (total science girls vs boys)
    regional_breakdown = []
    for region, totals in sorted(regional_spec_totals.items()):
        total = totals['filles'] + totals['garcons']
        if total > 0:
            regional_breakdown.append({
                'region': region,
                'girls': totals['filles'],
                'boys': totals['garcons'],
                'total': total,
                'pct_girls': round(100 * totals['filles'] / total, 1)
            })

    return {
        'year': latest_year,
        'specialization_breakdown': spec_breakdown[:15],  # Top 15
        'regional_breakdown': sorted(regional_breakdown, key=lambda x: x['total'], reverse=True)
    }


# =============================================================================
# CHARTS 3, 7, 8, 10: Parcoursup Data for CPGE
# Dataset: voeux_parcoursup.csv
# =============================================================================
def process_parcoursup():
    """
    Process the Parcoursup dataset to produce:
    - Funnel charts for CPGE admission (overall, girls, scholarship students)
    - Scatter plot of admission rates vs scholarship admission rates
    - Geographic distribution of CPGE programs
    """
    filepath = os.path.join(DATA_DIR, "voeux_parcoursup.csv")

    # Read header for column names
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        headers = next(reader)

    # Print some column names for debugging
    print(f"  Total columns: {len(headers)}")

    # Read all rows
    rows = read_csv_semicolon(filepath)
    print(f"  Total rows: {len(rows)}")

    # Find available sessions (years)
    sessions = set()
    filieres_agg = set()
    for row in rows:
        s = row.get('Session', '').strip()
        if s:
            sessions.add(s)
        fa = row.get('Filière de formation très agrégée', '').strip()
        if fa:
            filieres_agg.add(fa)

    print(f"  Sessions: {sorted(sessions)}")
    print(f"  Filières agrégées: {sorted(filieres_agg)}")

    # Use most recent session
    latest_session = max(sessions) if sessions else None
    print(f"  Using session: {latest_session}")

    # Filter for CPGE rows in latest session
    # The "Filière de formation très agrégée" should contain "CPGE"
    cpge_rows = []
    for row in rows:
        if row.get('Session', '').strip() != latest_session:
            continue
        filiere_agg = row.get('Filière de formation très agrégée', '').strip()
        if 'CPGE' in filiere_agg.upper():
            cpge_rows.append(row)

    print(f"  CPGE rows for {latest_session}: {len(cpge_rows)}")

    # If no CPGE found in 'très agrégée', try other filiere columns
    if len(cpge_rows) == 0:
        # Try the "Filière de formation détaillée" or other columns
        for row in rows:
            if row.get('Session', '').strip() != latest_session:
                continue
            for key in ['Filière de formation', 'Filière de formation détaillée',
                        'Filière de formation détaillée bis', 'Filière de formation très détaillée']:
                val = row.get(key, '').strip()
                if 'CPGE' in val.upper() or 'Classe préparatoire' in val:
                    cpge_rows.append(row)
                    break
        print(f"  CPGE rows (after broader search): {len(cpge_rows)}")

    # Print sample filiere values for CPGE rows
    if cpge_rows:
        sample = cpge_rows[0]
        print(f"  Sample CPGE row filières:")
        for key in ['Filière de formation', 'Filière de formation très agrégée',
                     'Filière de formation détaillée', 'Filière de formation détaillée bis',
                     'Filière de formation très détaillée']:
            print(f"    {key}: {sample.get(key, 'N/A')}")

    # ---- FUNNEL DATA (Charts 3 & 7) ----
    # Aggregate across all CPGE formations
    funnel_total = {
        'total_candidates': 0,
        'total_female_candidates': 0,
        'candidates_main_phase': 0,
        'candidates_ranked': 0,
        'candidates_offered': 0,
        'candidates_admitted': 0,
        'admitted_female': 0,
        'boursiers_candidates_general': 0,
        'boursiers_candidates_techno': 0,
        'boursiers_candidates_pro': 0,
        'admitted_boursiers': 0,
        'admitted_neo_bac': 0,
    }

    # For scatter plot (Chart 8) and geographic data (Chart 10)
    scatter_data = []
    geo_data = []

    for row in cpge_rows:
        # Funnel aggregation
        tc = parse_int(row.get('Effectif total des candidats pour une formation'))
        fc = parse_int(row.get('Dont effectif des candidates pour une formation'))
        cmp = parse_int(row.get('Effectif total des candidats en phase principale'))
        cr = parse_int(row.get("Effectif total des candidats classés par l'établissement en phase principale"))
        co = parse_int(row.get("Effectif total des candidats ayant reçu une proposition d'admission de la part de l'établissement"))
        ca = parse_int(row.get("Effectif total des candidats ayant accepté la proposition de l'établissement (admis)"))
        af = parse_int(row.get('Dont effectif des candidates admises'))
        ab = parse_int(row.get('Dont effectif des admis boursiers néo bacheliers'))
        anb = parse_int(row.get('Effectif des admis néo bacheliers'))

        # Boursiers candidates
        bcg = parse_int(row.get('Dont effectif des candidats boursiers néo bacheliers généraux en phase principale'))
        bct = parse_int(row.get('Dont effectif des candidats boursiers néo bacheliers technologiques en phase principale'))
        bcp = parse_int(row.get('Dont effectif des candidats boursiers néo bacheliers professionnels en phase principale'))

        if tc: funnel_total['total_candidates'] += tc
        if fc: funnel_total['total_female_candidates'] += fc
        if cmp: funnel_total['candidates_main_phase'] += cmp
        if cr: funnel_total['candidates_ranked'] += cr
        if co: funnel_total['candidates_offered'] += co
        if ca: funnel_total['candidates_admitted'] += ca
        if af: funnel_total['admitted_female'] += af
        if ab: funnel_total['admitted_boursiers'] += ab
        if anb: funnel_total['admitted_neo_bac'] += anb
        if bcg: funnel_total['boursiers_candidates_general'] += bcg
        if bct: funnel_total['boursiers_candidates_techno'] += bct
        if bcp: funnel_total['boursiers_candidates_pro'] += bcp

        # Scatter plot data: admission rate vs scholarship admission rate per institution
        capacity = parse_int(row.get("Capacité de l'établissement par formation"))
        pct_boursiers = parse_number(row.get("% d'admis néo bacheliers boursiers"))
        taux_acces = parse_number(row.get("Taux d'accès"))

        filiere_detail = row.get('Filière de formation détaillée', '').strip()
        if not filiere_detail:
            filiere_detail = row.get('Filière de formation détaillée bis', '').strip()
        etab = row.get('Établissement', '').strip()

        if taux_acces is not None and pct_boursiers is not None and ca and ca > 5:
            # Determine program type
            program = 'Other'
            fd_upper = filiere_detail.upper() if filiere_detail else ''
            if 'MPSI' in fd_upper or 'MP2I' in fd_upper:
                program = 'MPSI/MP2I'
            elif 'PCSI' in fd_upper:
                program = 'PCSI'
            elif 'PTSI' in fd_upper:
                program = 'PTSI'
            elif 'BCPST' in fd_upper:
                program = 'BCPST'
            elif 'TSI' in fd_upper:
                program = 'TSI'
            elif 'ECG' in fd_upper or 'ECE' in fd_upper or 'ECS' in fd_upper or 'COMMERC' in fd_upper:
                program = 'ECG'
            elif 'LETTRES' in fd_upper or 'LITTÉR' in fd_upper or 'LSH' in fd_upper:
                program = 'Lettres'

            scatter_data.append({
                'institution': etab,
                'program': program,
                'admission_rate': round(taux_acces, 1),
                'scholarship_pct': round(pct_boursiers, 1),
                'admitted': ca,
                'department': row.get("Département de l'établissement", '').strip(),
            })

        # Geographic data for CPGE distribution
        gps = row.get('Coordonnées GPS de la formation', '').strip()
        if gps and ca and ca > 0:
            parts = gps.split(',')
            if len(parts) == 2:
                try:
                    lat = float(parts[0].strip())
                    lon = float(parts[1].strip())
                    # Determine scientific program
                    program = 'Other'
                    fd_upper = filiere_detail.upper() if filiere_detail else ''
                    if 'MPSI' in fd_upper or 'MP2I' in fd_upper or 'MP/' in fd_upper:
                        program = 'MPSI'
                    elif 'PCSI' in fd_upper or 'PC/' in fd_upper:
                        program = 'PCSI'
                    elif 'PTSI' in fd_upper or 'PT/' in fd_upper:
                        program = 'PTSI'
                    elif 'BCPST' in fd_upper:
                        program = 'BCPST'
                    elif 'TSI' in fd_upper:
                        program = 'TSI'
                    elif 'ECG' in fd_upper or 'COMMERC' in fd_upper:
                        program = 'ECG'
                    elif 'LETTRES' in fd_upper or 'LITTÉR' in fd_upper:
                        program = 'Lettres'

                    # Only include scientific CPGE for the map
                    if program in ['MPSI', 'PCSI', 'PTSI', 'BCPST', 'TSI']:
                        geo_data.append({
                            'lat': lat,
                            'lon': lon,
                            'program': program,
                            'institution': etab,
                            'commune': row.get("Commune de l'établissement", '').strip(),
                            'admitted': ca,
                            'capacity': capacity or 0,
                        })
                except (ValueError, IndexError):
                    pass

    # Compute total boursiers candidates
    total_boursiers_candidates = (funnel_total['boursiers_candidates_general'] +
                                  funnel_total['boursiers_candidates_techno'] +
                                  funnel_total['boursiers_candidates_pro'])

    # Format funnel data
    funnel = {
        'session': latest_session,
        'overall': {
            'total_candidates': funnel_total['total_candidates'],
            'candidates_ranked': funnel_total['candidates_ranked'],
            'candidates_offered': funnel_total['candidates_offered'],
            'candidates_admitted': funnel_total['candidates_admitted'],
        },
        'girls': {
            'total_candidates': funnel_total['total_female_candidates'],
            'admitted': funnel_total['admitted_female'],
            'admission_rate': round(100 * funnel_total['admitted_female'] / funnel_total['total_female_candidates'], 1) if funnel_total['total_female_candidates'] > 0 else 0,
        },
        'scholarship': {
            'total_candidates': total_boursiers_candidates,
            'admitted': funnel_total['admitted_boursiers'],
            'admission_rate': round(100 * funnel_total['admitted_boursiers'] / total_boursiers_candidates, 1) if total_boursiers_candidates > 0 else 0,
        },
        'overall_admission_rate': round(100 * funnel_total['candidates_admitted'] / funnel_total['total_candidates'], 1) if funnel_total['total_candidates'] > 0 else 0,
    }

    print(f"\n  FUNNEL DATA:")
    print(f"    Total candidates: {funnel['overall']['total_candidates']:,}")
    print(f"    Ranked: {funnel['overall']['candidates_ranked']:,}")
    print(f"    Offered: {funnel['overall']['candidates_offered']:,}")
    print(f"    Admitted: {funnel['overall']['candidates_admitted']:,}")
    print(f"    Girls candidates: {funnel['girls']['total_candidates']:,}")
    print(f"    Girls admitted: {funnel['girls']['admitted']:,}")
    print(f"    Scholarship candidates: {funnel['scholarship']['total_candidates']:,}")
    print(f"    Scholarship admitted: {funnel['scholarship']['admitted']:,}")

    return {
        'funnel': funnel,
        'scatter': scatter_data,
        'geo_cpge': geo_data,
    }


# =============================================================================
# CHARTS 5 & 6: Scholarship Students
# Dataset: boursiers_par_departement.csv
# =============================================================================
def process_boursiers():
    """
    Process scholarship student data by department and sector.
    """
    filepath = os.path.join(DATA_DIR, "boursiers_par_departement.csv")
    rows = read_csv_semicolon(filepath)

    # Find latest year
    years = set()
    for row in rows:
        y = row.get('Rentrée scolaire', '').strip()
        if y:
            years.add(y)
    latest_year = max(years) if years else None
    print(f"  Years available: {sorted(years)}")
    print(f"  Using: {latest_year}")

    # Get formation types
    formations = set()
    for row in rows:
        f = row.get('Libellé formation', '').strip()
        if f:
            formations.add(f)
    print(f"  Formation types: {sorted(formations)}")

    # Chart 5: By department (all formation types, latest year)
    dept_totals = defaultdict(lambda: {'boursiers': 0, 'dernier_echelon': 0})
    # Chart 6: By sector (Public vs Private)
    sector_totals = defaultdict(lambda: {'boursiers': 0, 'dernier_echelon': 0})

    for row in rows:
        if row.get('Rentrée scolaire', '').strip() != latest_year:
            continue

        dept_num = row.get('Numéro département', '').strip()
        dept_name = row.get('Libellé département', '').strip()
        sector = row.get('Secteur', '').strip()
        nb = parse_int(row.get('Nb boursiers'))
        nde = parse_int(row.get('Nb dernier échelon'))

        if dept_num:
            if nb: dept_totals[dept_num]['boursiers'] += nb
            if nde: dept_totals[dept_num]['dernier_echelon'] += nde
            dept_totals[dept_num]['name'] = dept_name

        if sector:
            if nb: sector_totals[sector]['boursiers'] += nb
            if nde: sector_totals[sector]['dernier_echelon'] += nde

    # Format department data
    by_department = []
    for dept_num, data in sorted(dept_totals.items()):
        by_department.append({
            'code': dept_num,
            'name': data.get('name', dept_num),
            'boursiers': data['boursiers'],
            'dernier_echelon': data['dernier_echelon'],
        })

    # Format sector data
    by_sector = []
    for sector, data in sorted(sector_totals.items()):
        by_sector.append({
            'sector': sector,
            'boursiers': data['boursiers'],
            'dernier_echelon': data['dernier_echelon'],
        })

    return {
        'year': latest_year,
        'by_department': by_department,
        'by_sector': by_sector,
    }


# =============================================================================
# CHART 9: IPS (Social Position Index) by Department
# Dataset: IPS_lycees.csv
# =============================================================================
def process_ips():
    """
    Compute average IPS by department for choropleth map.
    """
    filepath = os.path.join(DATA_DIR, "IPS_lycees.csv")
    rows = read_csv_semicolon(filepath)

    # Find latest year
    years = set()
    for row in rows:
        y = row.get('Rentrée scolaire', '').strip()
        if y:
            years.add(y)
    latest_year = max(years) if years else None
    print(f"  IPS years: {sorted(years)}")
    print(f"  Using: {latest_year}")

    # Aggregate IPS by department
    dept_ips = defaultdict(lambda: {'sum_ips': 0, 'count': 0, 'name': ''})

    # Also aggregate by region
    region_ips = defaultdict(lambda: {'sum_ips': 0, 'count': 0})

    for row in rows:
        if row.get('Rentrée scolaire', '').strip() != latest_year:
            continue

        dept_code = row.get('Code du département', '').strip()
        if not dept_code:
            dept_code = row.get('Code département', '').strip()
        dept_name = row.get('Département', '').strip()
        region = row.get('Région académique', '').strip()

        # Use IPS de l'établissement (the overall IPS for the school)
        ips = parse_number(row.get("IPS de l'établissement"))
        if ips is None:
            # Try IPS voie GT
            ips = parse_number(row.get('IPS voie GT'))

        if ips and dept_code:
            dept_ips[dept_code]['sum_ips'] += ips
            dept_ips[dept_code]['count'] += 1
            dept_ips[dept_code]['name'] = dept_name

        if ips and region:
            region_ips[region]['sum_ips'] += ips
            region_ips[region]['count'] += 1

    # Compute averages
    by_department = []
    for dept_code, data in sorted(dept_ips.items()):
        if data['count'] > 0:
            avg_ips = round(data['sum_ips'] / data['count'], 1)
            by_department.append({
                'code': dept_code,
                'name': data['name'],
                'avg_ips': avg_ips,
                'count': data['count'],
            })

    by_region = []
    for region, data in sorted(region_ips.items()):
        if data['count'] > 0:
            by_region.append({
                'region': region,
                'avg_ips': round(data['sum_ips'] / data['count'], 1),
                'count': data['count'],
            })

    return {
        'year': latest_year,
        'by_department': by_department,
        'by_region': sorted(by_region, key=lambda x: x['avg_ips']),
    }


# =============================================================================
# CPGE Student Background
# Dataset: parcours_scolaires_etudiants_CPGE.csv
# =============================================================================
def process_cpge_paths():
    """
    Process the educational background of CPGE students.
    Shows what type of high school track students come from.
    """
    filepath = os.path.join(DATA_DIR, "parcours_scolaires_etudiants_CPGE.csv")
    rows = read_csv_semicolon(filepath)

    result = []
    for row in rows:
        year = row.get('Rentrée scolaire', '').strip()
        filiere = row.get('Filière', '').strip()
        entrants = parse_int(row.get("Nombre d'entrants"))
        pct_s = parse_number(row.get('Pourcentage de Terminale S'))
        pct_es = parse_number(row.get('Pourcentage de Terminale ES'))
        pct_l = parse_number(row.get('Pourcentage de Terminale L'))
        pct_techno = parse_number(row.get('Pourcentage de Terminales Techno'))
        pct_pro = parse_number(row.get('Pourcentage de Terminales Pro'))
        pct_other = parse_number(row.get("Pourcentage d'autre origine"))

        if year and filiere and entrants:
            result.append({
                'year': int(year),
                'filiere': filiere.replace('Filière ', ''),
                'entrants': entrants,
                'pct_terminale_s': pct_s or 0,
                'pct_terminale_es': pct_es or 0,
                'pct_terminale_l': pct_l or 0,
                'pct_techno': pct_techno or 0,
                'pct_pro': pct_pro or 0,
                'pct_other': pct_other or 0,
            })

    return sorted(result, key=lambda x: (x['year'], x['filiere']))


# =============================================================================
# Engineering Schools Effectifs
# Dataset: effectifs_ecoles_ingenieur.xls
# =============================================================================
def process_engineering_schools():
    """
    Process engineering school enrollment data.
    """
    filepath = os.path.join(DATA_DIR, "effectifs_ecoles_ingenieur.xls")

    try:
        import xlrd
        wb = xlrd.open_workbook(filepath)
        print(f"  Sheets: {wb.sheet_names()}")

        results = []
        for sheet_name in wb.sheet_names():
            ws = wb.sheet_by_name(sheet_name)
            print(f"  Sheet '{sheet_name}': {ws.nrows} rows x {ws.ncols} cols")
            if ws.nrows > 0:
                headers = [str(ws.cell_value(0, c)).strip() for c in range(ws.ncols)]
                print(f"    Headers: {headers[:10]}...")

                for r in range(1, ws.nrows):
                    row_data = {}
                    for c in range(ws.ncols):
                        row_data[headers[c]] = ws.cell_value(r, c)
                    results.append(row_data)

        # Return raw data for now - we'll format based on what we find
        return results
    except Exception as e:
        print(f"  Error reading XLS: {e}")
        return []


# =============================================================================
# MAIN
# =============================================================================
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("EquiLearn Data Processing")
    print("=" * 60)

    all_data = {}

    print("\n[1/6] Processing CPGE Effectifs...")
    all_data['cpge'] = process_cpge_effectifs()

    print("\n[2/6] Processing Specializations...")
    all_data['specializations'] = process_specializations()

    print("\n[3/6] Processing Parcoursup...")
    all_data['parcoursup'] = process_parcoursup()

    print("\n[4/6] Processing Scholarship Students...")
    all_data['boursiers'] = process_boursiers()

    print("\n[5/6] Processing IPS...")
    all_data['ips'] = process_ips()

    print("\n[6/6] Processing CPGE Student Paths...")
    all_data['cpge_paths'] = process_cpge_paths()

    # Try engineering schools (bonus)
    print("\n[Bonus] Processing Engineering Schools...")
    eng = process_engineering_schools()
    if eng:
        all_data['engineering_schools'] = eng

    # Write output
    output_path = os.path.join(OUTPUT_DIR, "data.js")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("// EquiLearn - Pre-processed chart data\n")
        f.write("// Generated by process_data.py\n")
        f.write("const CHART_DATA = ")
        json.dump(all_data, f, indent=2, ensure_ascii=False)
        f.write(";\n")

    file_size = os.path.getsize(output_path)
    print(f"\n{'=' * 60}")
    print(f"Output: {output_path} ({file_size:,} bytes)")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
