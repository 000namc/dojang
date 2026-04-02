CREATE DATABASE IF NOT EXISTS practice;
USE practice;

-- =============================================
-- 동물 보호소 테이블 (프로그래머스 대표 테이블)
-- =============================================

CREATE TABLE ANIMAL_INS (
    ANIMAL_ID VARCHAR(20) PRIMARY KEY,
    ANIMAL_TYPE VARCHAR(10) NOT NULL,
    DATETIME DATETIME NOT NULL,
    INTAKE_CONDITION VARCHAR(20) NOT NULL,
    NAME VARCHAR(50),
    SEX_UPON_INTAKE VARCHAR(30) NOT NULL
);

CREATE TABLE ANIMAL_OUTS (
    ANIMAL_ID VARCHAR(20) PRIMARY KEY,
    ANIMAL_TYPE VARCHAR(10) NOT NULL,
    DATETIME DATETIME NOT NULL,
    NAME VARCHAR(50),
    SEX_UPON_OUTCOME VARCHAR(30) NOT NULL
);

INSERT INTO ANIMAL_INS VALUES
('A349996', 'Cat', '2018-01-22 14:32:00', 'Normal', 'Sugar', 'Neutered Male'),
('A350276', 'Cat', '2017-08-13 13:50:00', 'Normal', 'Jewel', 'Spayed Female'),
('A350375', 'Cat', '2017-03-06 15:01:00', 'Normal', 'Meo', 'Neutered Male'),
('A352555', 'Dog', '2014-08-08 04:20:00', 'Normal', 'Harley', 'Spayed Female'),
('A352713', 'Cat', '2017-04-13 16:29:00', 'Normal', 'Eim', 'Spayed Female'),
('A352872', 'Dog', '2015-07-09 17:51:00', 'Aged', 'Peanutbutter', 'Neutered Male'),
('A353259', 'Dog', '2016-05-08 12:57:00', 'Injured', 'Bj', 'Neutered Male'),
('A354597', 'Cat', '2014-05-02 12:16:00', 'Normal', 'Ariel', 'Spayed Female'),
('A354725', 'Dog', '2017-01-28 15:31:00', 'Normal', 'Kia', 'Spayed Female'),
('A355519', 'Dog', '2014-08-15 08:13:00', 'Normal', 'Faith', 'Spayed Female'),
('A355688', 'Dog', '2014-01-26 13:48:00', 'Normal', 'Shadow', 'Neutered Male'),
('A355753', 'Dog', '2015-09-10 13:14:00', 'Normal', 'Elijah', 'Neutered Male'),
('A357021', 'Dog', '2017-07-09 07:42:00', 'Sick', NULL, 'Intact Male'),
('A357444', 'Dog', '2016-09-06 18:51:00', 'Normal', 'Puppy', 'Neutered Male'),
('A358697', 'Dog', '2015-02-05 12:27:00', 'Normal', 'Adelie', 'Spayed Female'),
('A358879', 'Dog', '2015-07-09 09:22:00', 'Normal', 'Gigi', 'Spayed Female'),
('A361391', 'Dog', '2016-01-25 10:31:00', 'Normal', NULL, 'Spayed Female'),
('A362103', 'Dog', '2016-02-27 12:27:00', 'Normal', 'Pepper', 'Intact Female'),
('A362383', 'Dog', '2014-12-20 12:31:00', 'Injured', '*Sam', 'Neutered Male'),
('A362707', 'Dog', '2016-01-27 12:27:00', 'Sick', 'Girly Girl', 'Spayed Female'),
('A363653', 'Dog', '2014-06-15 11:33:00', 'Normal', 'Goofy', 'Neutered Male'),
('A364429', 'Dog', '2017-09-16 09:28:00', 'Normal', 'Snuggles', 'Spayed Female'),
('A365172', 'Dog', '2014-08-26 12:53:00', 'Normal', 'Diablo', 'Neutered Male'),
('A365302', 'Dog', '2017-01-08 16:34:00', 'Aged', 'Minnie', 'Spayed Female'),
('A367012', 'Dog', '2015-09-16 09:06:00', 'Normal', 'Miller', 'Neutered Male'),
('A367438', 'Dog', '2015-09-10 16:01:00', 'Normal', 'Cookie', 'Spayed Female'),
('A368742', 'Dog', '2014-01-03 16:19:00', 'Normal', NULL, 'Intact Female'),
('A370439', 'Dog', '2016-06-08 09:46:00', 'Normal', NULL, 'Neutered Male'),
('A370507', 'Cat', '2014-10-27 14:43:00', 'Normal', 'Emily', 'Spayed Female'),
('A371000', 'Cat', '2015-07-29 16:07:00', 'Normal', 'Greg', 'Neutered Male');

INSERT INTO ANIMAL_OUTS VALUES
('A349996', 'Cat', '2018-01-25 14:32:00', 'Sugar', 'Neutered Male'),
('A350276', 'Cat', '2018-01-28 17:51:00', 'Jewel', 'Spayed Female'),
('A350375', 'Cat', '2017-03-30 10:30:00', 'Meo', 'Neutered Male'),
('A352555', 'Dog', '2014-08-20 12:25:00', 'Harley', 'Spayed Female'),
('A352713', 'Cat', '2017-04-25 12:25:00', 'Eim', 'Spayed Female'),
('A352872', 'Dog', '2015-08-13 12:28:00', 'Peanutbutter', 'Neutered Male'),
('A353259', 'Dog', '2016-05-13 15:40:00', 'Bj', 'Neutered Male'),
('A354597', 'Cat', '2014-05-15 09:30:00', 'Ariel', 'Spayed Female'),
('A354725', 'Dog', '2017-03-16 12:52:00', 'Kia', 'Spayed Female'),
('A355519', 'Dog', '2014-08-20 12:30:00', 'Faith', 'Spayed Female'),
('A355688', 'Dog', '2014-02-03 12:30:00', 'Shadow', 'Neutered Male'),
('A355753', 'Dog', '2015-10-08 15:30:00', 'Elijah', 'Neutered Male'),
('A357444', 'Dog', '2016-09-15 09:28:00', 'Puppy', 'Neutered Male'),
('A358697', 'Dog', '2015-02-17 14:20:00', 'Adelie', 'Spayed Female'),
('A358879', 'Dog', '2015-07-14 10:10:00', 'Gigi', 'Spayed Female'),
('A362103', 'Dog', '2016-03-21 12:40:00', 'Pepper', 'Spayed Female'),
('A362383', 'Dog', '2015-01-10 09:00:00', '*Sam', 'Neutered Male'),
('A362707', 'Dog', '2017-01-31 12:45:00', 'Girly Girl', 'Spayed Female'),
('A363653', 'Dog', '2014-07-05 11:20:00', 'Goofy', 'Neutered Male'),
('A364429', 'Dog', '2017-10-12 12:30:00', 'Snuggles', 'Spayed Female'),
('A365172', 'Dog', '2014-09-10 15:40:00', 'Diablo', 'Neutered Male'),
('A365302', 'Dog', '2017-01-11 15:45:00', 'Minnie', 'Spayed Female'),
('A367012', 'Dog', '2015-09-18 10:30:00', 'Miller', 'Neutered Male'),
('A367438', 'Dog', '2015-10-08 09:00:00', 'Cookie', 'Spayed Female'),
('A370439', 'Dog', '2016-06-22 14:20:00', NULL, 'Neutered Male'),
('A370507', 'Cat', '2014-12-19 09:00:00', 'Emily', 'Spayed Female'),
('A371000', 'Cat', '2015-08-15 09:00:00', 'Greg', 'Neutered Male');

-- =============================================
-- 식품 관련 테이블
-- =============================================

CREATE TABLE FOOD_PRODUCT (
    PRODUCT_ID INT PRIMARY KEY,
    PRODUCT_NAME VARCHAR(100) NOT NULL,
    PRODUCT_CD VARCHAR(10) NOT NULL,
    CATEGORY VARCHAR(50),
    PRICE INT
);

CREATE TABLE FOOD_ORDER (
    ORDER_ID INT PRIMARY KEY AUTO_INCREMENT,
    PRODUCT_ID INT,
    AMOUNT INT,
    PRODUCE_DATE DATE,
    IN_DATE DATE,
    OUT_DATE DATE,
    FACTORY_ID VARCHAR(20),
    WAREHOUSE_ID VARCHAR(20),
    FOREIGN KEY (PRODUCT_ID) REFERENCES FOOD_PRODUCT(PRODUCT_ID)
);

CREATE TABLE FOOD_FACTORY (
    FACTORY_ID VARCHAR(20) PRIMARY KEY,
    FACTORY_NAME VARCHAR(100),
    ADDRESS VARCHAR(200),
    TLNO VARCHAR(20)
);

CREATE TABLE FOOD_WAREHOUSE (
    WAREHOUSE_ID VARCHAR(20) PRIMARY KEY,
    WAREHOUSE_NAME VARCHAR(100),
    ADDRESS VARCHAR(200),
    TLNO VARCHAR(20),
    FREEZER_YN VARCHAR(1)
);

INSERT INTO FOOD_PRODUCT VALUES
(1001, '홍삼절편', 'CD01', '건강식품', 25000),
(1002, '## 블루베리잼', 'CD02', '가공식품', 8500),
(1003, '맛있는우유', 'CD03', '유제품', 2800),
(1004, '프로틴바', 'CD01', '건강식품', 3500),
(1005, '고구마칩', 'CD02', '과자', 1500),
(1006, '그릭요거트', 'CD03', '유제품', 4200),
(1007, '아몬드', 'CD01', '건강식품', 12000),
(1008, '카스테라', 'CD02', '과자', 6800),
(1009, '치즈', 'CD03', '유제품', 9500),
(1010, '비타민C', 'CD01', '건강식품', 15000),
(1011, '초코파이', 'CD02', '과자', 4800),
(1012, '두유', 'CD03', '유제품', 3200);

INSERT INTO FOOD_FACTORY VALUES
('FT001', '서울식품공장', '서울특별시 강남구 역삼동 123', '010-1234-5678'),
('FT002', '부산가공센터', '부산광역시 해운대구 우동 456', '010-2345-6789'),
('FT003', '대전제조공장', '대전광역시 유성구 봉명동 789', '010-3456-7890'),
('FT004', '인천식품센터', '인천광역시 남동구 구월동 321', '010-4567-8901');

INSERT INTO FOOD_WAREHOUSE VALUES
('WH001', '서울냉동창고', '서울특별시 송파구 문정동 100', '010-1111-2222', 'Y'),
('WH002', '경기상온창고', '경기도 용인시 수지구 풍덕천동 200', '010-2222-3333', 'N'),
('WH003', '부산냉장창고', '부산광역시 사하구 하단동 300', '010-3333-4444', 'Y'),
('WH004', '대전물류센터', '대전광역시 서구 둔산동 400', '010-4444-5555', 'N'),
('WH005', '인천냉동창고', '인천광역시 연수구 송도동 500', '010-5555-6666', 'Y');

INSERT INTO FOOD_ORDER (PRODUCT_ID, AMOUNT, PRODUCE_DATE, IN_DATE, OUT_DATE, FACTORY_ID, WAREHOUSE_ID) VALUES
(1001, 100, '2025-01-05', '2025-01-10', '2025-01-15', 'FT001', 'WH001'),
(1002, 200, '2025-01-08', '2025-01-12', '2025-01-18', 'FT002', 'WH002'),
(1003, 500, '2025-01-10', '2025-01-13', '2025-01-20', 'FT001', 'WH001'),
(1004, 150, '2025-01-15', '2025-01-18', '2025-01-25', 'FT003', 'WH003'),
(1005, 300, '2025-02-01', '2025-02-05', '2025-02-10', 'FT002', 'WH002'),
(1006, 250, '2025-02-03', '2025-02-07', NULL, 'FT001', 'WH003'),
(1007, 80, '2025-02-10', '2025-02-14', '2025-02-20', 'FT004', 'WH004'),
(1008, 120, '2025-02-15', '2025-02-18', NULL, 'FT002', 'WH002'),
(1009, 90, '2025-03-01', '2025-03-05', '2025-03-12', 'FT003', 'WH001'),
(1010, 60, '2025-03-05', '2025-03-08', NULL, 'FT004', 'WH005'),
(1011, 400, '2025-03-10', '2025-03-14', '2025-03-20', 'FT002', 'WH002'),
(1012, 350, '2025-03-15', '2025-03-18', NULL, 'FT001', 'WH004'),
(1001, 200, '2025-04-01', '2025-04-05', '2025-04-10', 'FT001', 'WH001'),
(1003, 600, '2025-04-05', '2025-04-08', NULL, 'FT003', 'WH003');

-- =============================================
-- 회원/판매 테이블
-- =============================================

CREATE TABLE MEMBER_PROFILE (
    MEMBER_ID VARCHAR(20) PRIMARY KEY,
    MEMBER_NAME VARCHAR(50) NOT NULL,
    TLNO VARCHAR(20),
    GENDER VARCHAR(1),
    DATE_OF_BIRTH DATE
);

CREATE TABLE REST_INFO (
    REST_ID INT PRIMARY KEY,
    REST_NAME VARCHAR(100) NOT NULL,
    FOOD_TYPE VARCHAR(50),
    VIEWS INT,
    FAVORITES INT,
    PARKING_LOT VARCHAR(1),
    ADDRESS VARCHAR(200),
    TEL VARCHAR(20)
);

CREATE TABLE REST_REVIEW (
    REVIEW_ID INT PRIMARY KEY AUTO_INCREMENT,
    REST_ID INT,
    MEMBER_ID VARCHAR(20),
    REVIEW_SCORE INT,
    REVIEW_TEXT VARCHAR(500),
    REVIEW_DATE DATE,
    FOREIGN KEY (REST_ID) REFERENCES REST_INFO(REST_ID),
    FOREIGN KEY (MEMBER_ID) REFERENCES MEMBER_PROFILE(MEMBER_ID)
);

INSERT INTO MEMBER_PROFILE VALUES
('MEM001', '김철수', '010-1234-5678', 'M', '1990-05-15'),
('MEM002', '이영희', '010-2345-6789', 'F', '1985-11-22'),
('MEM003', '박민수', NULL, 'M', '1992-03-08'),
('MEM004', '정수진', '010-4567-8901', 'F', '1988-07-30'),
('MEM005', '최동현', '010-5678-9012', 'M', '1995-01-12'),
('MEM006', '한지은', '010-6789-0123', 'F', NULL),
('MEM007', '오준서', NULL, 'M', '1993-09-25'),
('MEM008', '윤서연', '010-8901-2345', 'F', '1991-12-03');

INSERT INTO REST_INFO VALUES
(1, '한식당', '한식', 5000, 150, 'Y', '서울특별시 강남구', '02-1234-5678'),
(2, '스시오마카세', '일식', 8000, 300, 'N', '서울특별시 서초구', '02-2345-6789'),
(3, '양자강', '중식', 3000, 80, 'Y', '서울특별시 종로구', '02-3456-7890'),
(4, '파스타하우스', '양식', 6000, 200, 'Y', '서울특별시 마포구', '02-4567-8901'),
(5, '김밥천국', '한식', 12000, 50, 'N', '서울특별시 관악구', '02-5678-9012'),
(6, '돈카츠집', '일식', 4500, 120, 'Y', '서울특별시 송파구', '02-6789-0123'),
(7, '마라탕', '중식', 7000, 250, 'N', '서울특별시 강서구', '02-7890-1234');

INSERT INTO REST_REVIEW (REST_ID, MEMBER_ID, REVIEW_SCORE, REVIEW_TEXT, REVIEW_DATE) VALUES
(1, 'MEM001', 5, '정말 맛있어요!', '2025-01-15'),
(1, 'MEM002', 4, '분위기가 좋아요', '2025-01-20'),
(2, 'MEM003', 5, '최고의 스시', '2025-02-01'),
(2, 'MEM001', 4, '신선해요', '2025-02-05'),
(2, 'MEM004', 5, '또 오고 싶어요', '2025-02-10'),
(3, 'MEM005', 3, '보통이에요', '2025-02-15'),
(4, 'MEM002', 4, '파스타가 맛있어요', '2025-03-01'),
(4, 'MEM006', 5, '분위기 최고', '2025-03-05'),
(5, 'MEM007', 2, '좀 아쉬워요', '2025-03-10'),
(5, 'MEM001', 3, '가성비는 좋아요', '2025-03-12'),
(6, 'MEM008', 4, '바삭해요', '2025-03-20'),
(6, 'MEM004', 5, '돈카츠 맛집!', '2025-03-22'),
(7, 'MEM005', 4, '매콤해서 좋아요', '2025-04-01'),
(7, 'MEM003', 3, '너무 매워요', '2025-04-05'),
(1, 'MEM008', 5, '재방문 의사 100%', '2025-04-10'),
(3, 'MEM002', 4, '짬뽕이 맛있어요', '2025-04-15'),
(2, 'MEM006', 5, '사케도 맛있어요', '2025-04-20');
